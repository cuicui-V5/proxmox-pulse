import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

class PveClient {
  constructor(config = {}) {
    this.host = config.host || process.env.PVE_HOST || '192.168.2.5';
    this.port = config.port || process.env.PVE_PORT || 8006;
    this.tokenId = config.tokenId || process.env.PVE_TOKEN_ID || 'root@pam!dashboard';
    this.tokenSecret = config.tokenSecret || process.env.PVE_TOKEN_SECRET || '';
    this.verifySsl = config.verifySsl ?? (process.env.PVE_VERIFY_SSL === 'true');

    this.initAxios();
  }

  initAxios() {
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: this.verifySsl
    });

    this.axios = axios.create({
      baseURL: `https://${this.host}:${this.port}/api2/json`,
      headers: {
        'Authorization': `PVEAPIToken=${this.tokenId}=${this.tokenSecret}`
      },
      httpsAgent: this.httpsAgent,
      timeout: 15000
    });
  }

  updateConfig(newConfig) {
    if (newConfig.host) this.host = newConfig.host;
    if (newConfig.port) this.port = newConfig.port;
    if (newConfig.tokenId) this.tokenId = newConfig.tokenId;
    if (newConfig.tokenSecret) this.tokenSecret = newConfig.tokenSecret;
    if (newConfig.verifySsl !== undefined) this.verifySsl = newConfig.verifySsl;

    this.initAxios();
  }

  getConfig() {
    return {
      host: this.host,
      port: this.port,
      tokenId: this.tokenId,
      hasSecret: !!this.tokenSecret,
      verifySsl: this.verifySsl
    };
  }

  async getVersion() {
    const res = await this.axios.get('/version');
    return res.data?.data;
  }

  async getClusterResources() {
    const res = await this.axios.get('/cluster/resources');
    return res.data?.data || [];
  }

  async getNodes() {
    const res = await this.axios.get('/nodes');
    return res.data?.data || [];
  }

  async getNodeStatus(node) {
    const res = await this.axios.get(`/nodes/${node}/status`);
    return res.data?.data;
  }

  async getNodeRrdData(node, timeframe = 'hour') {
    const res = await this.axios.get(`/nodes/${node}/rrddata`, {
      params: { timeframe }
    });
    return res.data?.data || [];
  }

  async getGuestStatus(node, type, vmid) {
    const res = await this.axios.get(`/nodes/${node}/${type}/${vmid}/status/current`);
    return res.data?.data;
  }

  async getGuestConfig(node, type, vmid) {
    try {
      const res = await this.axios.get(`/nodes/${node}/${type}/${vmid}/config`);
      return res.data?.data;
    } catch {
      return null;
    }
  }

  async getGuestAgentInterfaces(node, vmid) {
    try {
      const res = await this.axios.get(`/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`, {
        timeout: 4000
      });
      return res.data?.data?.result || [];
    } catch {
      return [];
    }
  }

  async getGuestRrdData(node, type, vmid, timeframe = 'hour') {
    const res = await this.axios.get(`/nodes/${node}/${type}/${vmid}/rrddata`, {
      params: { timeframe }
    });
    return res.data?.data || [];
  }

  async executeGuestAction(node, type, vmid, action) {
    const validActions = ['start', 'shutdown', 'stop', 'reboot', 'reset', 'suspend', 'resume'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }
    const res = await this.axios.post(`/nodes/${node}/${type}/${vmid}/status/${action}`);
    return {
      upid: res.data?.data,
      action,
      vmid,
      node,
      type
    };
  }

  async getTaskStatus(node, upid) {
    const res = await this.axios.get(`/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`);
    return res.data?.data;
  }

  async getStorage(node) {
    const res = await this.axios.get(`/nodes/${node}/storage`);
    return res.data?.data || [];
  }
}

export default new PveClient();
