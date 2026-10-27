import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pveClient from './pveClient.js';
import thermalService from './thermalService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());

// Helper for caching guest IPs to keep requests snappy
const ipCache = new Map(); // vmid -> { ips: [], timestamp: number }
const CACHE_TTL = 30000; // 30s cache for guest agent IPs

// 1. Health check & PVE connectivity
app.get('/api/health', async (req, res) => {
  try {
    const version = await pveClient.getVersion();
    res.json({ ok: true, version, connected: true });
  } catch (err) {
    res.status(502).json({
      ok: false,
      connected: false,
      error: err.message || 'Cannot reach Proxmox VE server',
      config: pveClient.getConfig()
    });
  }
});

// 2. Aggregated Overview (for high-performance single-request dashboard refresh)
app.get('/api/overview', async (req, res) => {
  try {
    const [version, resources, nodes] = await Promise.all([
      pveClient.getVersion().catch(() => null),
      pveClient.getClusterResources().catch(() => []),
      pveClient.getNodes().catch(() => [])
    ]);

    // Primary node status (e.g. 'pve' or first available node)
    const primaryNodeName = nodes[0]?.node || 'pve';
    const [nodeStatus, storages, thermal] = await Promise.all([
      pveClient.getNodeStatus(primaryNodeName).catch(() => null),
      pveClient.getStorage(primaryNodeName).catch(() => []),
      thermalService.getTemperature(null, pveClient.getSshConfig()).catch(() => ({ available: false }))
    ]);

    // Breakdown resources
    const guests = resources.filter(r => r.type === 'qemu' || r.type === 'lxc');
    const runningGuests = guests.filter(g => g.status === 'running');
    const stoppedGuests = guests.filter(g => g.status === 'stopped');
    const pausedGuests = guests.filter(g => g.status === 'paused');

    res.json({
      ok: true,
      timestamp: Date.now(),
      version,
      primaryNode: primaryNodeName,
      nodeStatus,
      nodes,
      storages,
      thermal,
      summary: {
        totalGuests: guests.length,
        runningGuests: runningGuests.length,
        stoppedGuests: stoppedGuests.length,
        pausedGuests: pausedGuests.length,
        qemuCount: guests.filter(g => g.type === 'qemu').length,
        lxcCount: guests.filter(g => g.type === 'lxc').length
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Node status
app.get('/api/nodes/:node/status', async (req, res) => {
  try {
    const data = await pveClient.getNodeStatus(req.params.node);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3.1 Node Thermal Temperature
app.get('/api/nodes/:node/thermal', async (req, res) => {
  try {
    const nodeStatus = await pveClient.getNodeStatus(req.params.node).catch(() => null);
    const thermal = await thermalService.getTemperature(nodeStatus, pveClient.getSshConfig());
    res.json({ ok: true, thermal });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Node Historical RRD Metrics
app.get('/api/nodes/:node/rrddata', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'hour';
    const data = await pveClient.getNodeRrdData(req.params.node, timeframe);
    res.json({ ok: true, timeframe, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Unified Guests List (VMs & LXCs) with IPs
app.get('/api/guests', async (req, res) => {
  try {
    const resources = await pveClient.getClusterResources();
    const guests = resources.filter(r => r.type === 'qemu' || r.type === 'lxc');

    // Enrich running QEMU guests with IP addresses asynchronously
    const now = Date.now();
    const enriched = await Promise.all(
      guests.map(async guest => {
        let ips = [];
        if (guest.type === 'qemu' && guest.status === 'running') {
          const cached = ipCache.get(guest.vmid);
          if (cached && now - cached.timestamp < CACHE_TTL) {
            ips = cached.ips;
          } else {
            try {
              const ifaces = await pveClient.getGuestAgentInterfaces(guest.node, guest.vmid);
              for (const iface of ifaces) {
                if (iface.name && (iface.name.startsWith('lo') || iface.name.startsWith('docker') || iface.name.startsWith('veth'))) {
                  continue;
                }
                const addrs = iface['ip-addresses'] || [];
                for (const addr of addrs) {
                  if (addr['ip-address-type'] === 'ipv4' && !addr['ip-address'].startsWith('127.')) {
                    ips.push(addr['ip-address']);
                  }
                }
              }
              ipCache.set(guest.vmid, { ips, timestamp: now });
            } catch {
              // agent might not be installed or not responding
            }
          }
        }
        return {
          ...guest,
          ips
        };
      })
    );

    res.json({ ok: true, guests: enriched });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Guest Details (Status, Config, Agent Interfaces)
app.get('/api/guests/:node/:type/:vmid', async (req, res) => {
  const { node, type, vmid } = req.params;
  try {
    const [status, config] = await Promise.all([
      pveClient.getGuestStatus(node, type, vmid).catch(() => null),
      pveClient.getGuestConfig(node, type, vmid).catch(() => null)
    ]);

    let agentInterfaces = [];
    if (type === 'qemu' && status?.status === 'running') {
      agentInterfaces = await pveClient.getGuestAgentInterfaces(node, vmid);
    }

    res.json({
      ok: true,
      guest: {
        node,
        type,
        vmid: parseInt(vmid, 10),
        status,
        config,
        agentInterfaces
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Guest Historical RRD Metrics
app.get('/api/guests/:node/:type/:vmid/rrddata', async (req, res) => {
  const { node, type, vmid } = req.params;
  const timeframe = req.query.timeframe || 'hour';
  try {
    const data = await pveClient.getGuestRrdData(node, type, vmid, timeframe);
    res.json({ ok: true, timeframe, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 8. Execute Guest Power Action (start, shutdown, stop, reboot, reset)
app.post('/api/guests/:node/:type/:vmid/action', async (req, res) => {
  const { node, type, vmid } = req.params;
  const { action } = req.body;
  if (!action) {
    return res.status(400).json({ ok: false, error: 'Action is required' });
  }

  try {
    const result = await pveClient.executeGuestAction(node, type, vmid, action);
    // Invalidate IP cache if stopping/rebooting
    if (['stop', 'shutdown', 'reboot', 'reset'].includes(action)) {
      ipCache.delete(parseInt(vmid, 10));
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.response?.data?.errors || err.message || 'Action failed'
    });
  }
});

// 9. Task status polling
app.get('/api/tasks/:node/:upid', async (req, res) => {
  const { node, upid } = req.params;
  try {
    const status = await pveClient.getTaskStatus(node, upid);
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 10. Storages
app.get('/api/storage', async (req, res) => {
  const node = req.query.node || 'pve';
  try {
    const storages = await pveClient.getStorage(node);
    res.json({ ok: true, storages });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 11. Configuration endpoints
app.get('/api/config', (req, res) => {
  res.json({ ok: true, config: pveClient.getConfig() });
});

app.post('/api/config', async (req, res) => {
  try {
    pveClient.updateConfig(req.body);
    const version = await pveClient.getVersion();
    res.json({ ok: true, message: 'Configuration updated and connected', version });
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Connection failed with provided credentials: ' + err.message });
  }
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PVE Dashboard Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[PVE Target] Connecting to https://${pveClient.host}:${pveClient.port}`);
});
