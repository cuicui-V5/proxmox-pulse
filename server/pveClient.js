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

    // SSH thermal sensor config
    this.sshHost = config.sshHost || process.env.PVE_SSH_HOST || this.host;
    this.sshPort = config.sshPort || process.env.PVE_SSH_PORT || 22;
    this.sshUser = config.sshUser || process.env.PVE_SSH_USER || 'root';
    this.sshPassword = config.sshPassword || process.env.PVE_SSH_PASSWORD || '';
    this.sshKey = config.sshKey || process.env.PVE_SSH_KEY || '';

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

    if (newConfig.sshHost) this.sshHost = newConfig.sshHost;
    if (newConfig.sshPort) this.sshPort = newConfig.sshPort;
    if (newConfig.sshUser) this.sshUser = newConfig.sshUser;
    if (newConfig.sshPassword) this.sshPassword = newConfig.sshPassword;
    if (newConfig.sshKey) this.sshKey = newConfig.sshKey;

    this.initAxios();
  }

  getSshConfig() {
    return {
      host: this.sshHost || this.host,
      port: this.sshPort || 22,
      username: this.sshUser || 'root',
      password: this.sshPassword,
      privateKey: this.sshKey
    };
  }

  getConfig() {
    return {
      host: this.host,
      port: this.port,
      tokenId: this.tokenId,
      hasSecret: !!this.tokenSecret,
      verifySsl: this.verifySsl,
      sshHost: this.sshHost,
      sshPort: this.sshPort,
      sshUser: this.sshUser,
      hasSshPassword: !!this.sshPassword,
      hasSshKey: !!this.sshKey
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
