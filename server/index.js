import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import pveClient from './pveClient.js';
import thermalService from './thermalService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());

// Helper for caching guest IPs & onboot config to keep requests snappy
const ipCache = new Map(); // vmid -> { ips: [], timestamp: number }
const onbootCache = new Map(); // vmid -> { onboot: boolean, timestamp: number }
const CACHE_TTL = 30000; // 30s cache

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
    const [nodeStatus, storages] = await Promise.all([
      pveClient.getNodeStatus(primaryNodeName).catch(() => null),
      pveClient.getStorage(primaryNodeName).catch(() => [])
    ]);

    const thermal = await thermalService.getTemperature(nodeStatus).catch(() => ({ available: false }));

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
    const thermal = await thermalService.getTemperature(nodeStatus);
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

    // Enrich guests with IPs and onboot status asynchronously
    const now = Date.now();
    const enriched = await Promise.all(
      guests.map(async guest => {
        let ips = [];
        let onboot = false;

        // 1. Onboot configuration
        const cachedOnboot = onbootCache.get(guest.vmid);
        if (cachedOnboot && now - cachedOnboot.timestamp < CACHE_TTL) {
          onboot = cachedOnboot.onboot;
        } else {
          try {
            const cfg = await pveClient.getGuestConfig(guest.node, guest.type, guest.vmid);
            onboot = cfg?.onboot === 1;
            onbootCache.set(guest.vmid, { onboot, timestamp: now });
          } catch {}
        }

        // 2. QEMU Guest Agent IPs
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
          ips,
          onboot
        };
      })
    );

    res.json({ ok: true, guests: enriched });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5.1 Toggle Guest Auto-start (onboot)
app.post('/api/guests/:node/:type/:vmid/onboot', async (req, res) => {
  const { node, type, vmid } = req.params;
  const { onboot } = req.body;
  try {
    await pveClient.setGuestConfig(node, type, vmid, { onboot: onboot ? 1 : 0 });
    onbootCache.set(parseInt(vmid, 10), { onboot: !!onboot, timestamp: Date.now() });
    res.json({ ok: true, onboot: !!onboot, vmid: parseInt(vmid, 10), node });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.response?.data?.errors || err.message || 'Failed to update onboot'
    });
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

// 8.1 Request VNC Proxy Ticket
app.post('/api/guests/:node/:type/:vmid/vncproxy', async (req, res) => {
  const { node, type, vmid } = req.params;
  try {
    const data = await pveClient.getVncProxy(node, type, vmid);
    res.json({
      ok: true,
      ticket: data.ticket,
      port: data.port,
      password: data.password,
      cert: data.cert,
      user: data.user,
      upid: data.upid
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.response?.data?.errors || err.message || 'Failed to initialize VNC proxy'
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

// 10.1 Physical Disks & SMART Health Status
app.get('/api/nodes/:node/disks', async (req, res) => {
  const node = req.params.node || 'pve';
  try {
    const rawDisks = await pveClient.getDisksList(node);
    const enriched = await Promise.all(
      rawDisks.map(async (disk) => {
        let smart = null;
        let temp = null;
        let powerOnHours = null;
        try {
          smart = await pveClient.getDiskSmart(node, disk.devpath);
          const attrs = smart?.attributes || [];
          const tempAttr = attrs.find(a => a.name?.toLowerCase().includes('temp'));
          const hoursAttr = attrs.find(a => a.name?.toLowerCase().includes('power_on_hours'));
          temp = tempAttr?.raw ? parseInt(tempAttr.raw, 10) : null;
          powerOnHours = hoursAttr?.raw ? parseInt(hoursAttr.raw, 10) : null;
        } catch {}
        return {
          ...disk,
          smartHealth: smart?.health || disk.health || 'UNKNOWN',
          temperature: temp,
          powerOnHours
        };
      })
    );
    res.json({ ok: true, disks: enriched });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 10.2 Host Power Management (reboot, shutdown)
app.post('/api/nodes/:node/action', async (req, res) => {
  const { node } = req.params;
  const { command } = req.body;
  if (!['reboot', 'shutdown'].includes(command)) {
    return res.status(400).json({ ok: false, error: 'Command must be reboot or shutdown' });
  }
  try {
    const result = await pveClient.executeNodeAction(node, command);
    res.json({ ok: true, message: `Node ${node} ${command} initiated`, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.response?.data?.errors || err.message || 'Action failed' });
  }
});

// 10.3 Host Web Shell Termproxy Ticket
app.post('/api/nodes/:node/termproxy', async (req, res) => {
  const { node } = req.params;
  try {
    const data = await pveClient.getHostTermProxy(node);
    res.json({
      ok: true,
      port: data.port,
      ticket: data.ticket,
      user: data.user,
      upid: data.upid
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.response?.data?.errors || err.message || 'Failed to start termproxy' });
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

// 12. WebSocket Proxy for noVNC
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/vnc-ws') {
      const port = url.searchParams.get('port');
      const ticket = url.searchParams.get('ticket');
      const vmid = url.searchParams.get('vmid');
      const node = url.searchParams.get('node');
      const type = url.searchParams.get('type') || 'qemu';

      if (!port || !ticket || !vmid || !node) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (clientWs) => {
        const pveWsUrl = `wss://${pveClient.host}:${pveClient.port}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(ticket)}`;

        const pveWs = new WebSocket(pveWsUrl, {
          rejectUnauthorized: pveClient.verifySsl,
          headers: {
            'Authorization': `PVEAPIToken=${pveClient.tokenId}=${pveClient.tokenSecret}`
          }
        });

        const queue = [];
        let isPveOpen = false;

        pveWs.on('open', () => {
          isPveOpen = true;
          while (queue.length > 0) {
            const item = queue.shift();
            pveWs.send(item.msg, { binary: item.isBinary });
          }
        });

        clientWs.on('message', (msg, isBinary) => {
          if (isPveOpen && pveWs.readyState === WebSocket.OPEN) {
            pveWs.send(msg, { binary: isBinary });
          } else {
            queue.push({ msg, isBinary });
          }
        });

        pveWs.on('message', (msg, isBinary) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(msg, { binary: isBinary });
          }
        });

        const cleanup = () => {
          try { if (clientWs.readyState === WebSocket.OPEN) clientWs.close(); } catch {}
          try { if (pveWs.readyState === WebSocket.OPEN) pveWs.close(); } catch {}
        };

        clientWs.on('close', cleanup);
        pveWs.on('close', cleanup);
        clientWs.on('error', () => cleanup());
        pveWs.on('error', () => cleanup());
      });
    } else if (url.pathname === '/api/term-ws') {
      const port = url.searchParams.get('port');
      const ticket = url.searchParams.get('ticket');
      const node = url.searchParams.get('node');
      const user = url.searchParams.get('user') || pveClient.tokenId;

      if (!port || !ticket || !node) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (clientWs) => {
        const pveWsUrl = `wss://${pveClient.host}:${pveClient.port}/api2/json/nodes/${node}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(ticket)}`;

        const pveWs = new WebSocket(pveWsUrl, {
          rejectUnauthorized: pveClient.verifySsl,
          headers: {
            'Authorization': `PVEAPIToken=${pveClient.tokenId}=${pveClient.tokenSecret}`
          }
        });

        let authenticated = false;

        pveWs.on('open', () => {
          // Send PVE termproxy initial authentication handshake
          pveWs.send(`${user}:${ticket}\n`);
        });

        clientWs.on('message', (msg) => {
          if (pveWs.readyState === WebSocket.OPEN) {
            pveWs.send(msg);
          }
        });

        pveWs.on('message', (data) => {
          const str = data.toString('utf8');
          if (!authenticated) {
            if (str.startsWith('OK')) {
              authenticated = true;
              if (clientWs.readyState === WebSocket.OPEN) {
                // Send ready signal to notify frontend immediately
                clientWs.send(JSON.stringify({ type: 'ready' }));
              }
              const rest = str.replace(/^OK\r?\n?/, '');
              if (rest.length > 0 && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(rest);
              }
              return;
            }
          }
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(str);
          }
        });

        const cleanup = () => {
          try { if (clientWs.readyState === WebSocket.OPEN) clientWs.close(); } catch {}
          try { if (pveWs.readyState === WebSocket.OPEN) pveWs.close(); } catch {}
        };

        clientWs.on('close', cleanup);
        pveWs.on('close', cleanup);
        clientWs.on('error', () => cleanup());
        pveWs.on('error', () => cleanup());
      });
    } else {
      socket.destroy();
    }
  } catch {
    socket.destroy();
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[PVE Dashboard Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[PVE Target] Connecting to https://${pveClient.host}:${pveClient.port}`);
});
