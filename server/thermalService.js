import { Client } from 'ssh2';

class ThermalService {
  constructor() {
    this.cache = null;
    this.lastFetch = 0;
    this.fetchPromise = null;
    this.CACHE_TTL = 5000; // 5s cache
  }

  parseSensorsJson(raw) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      let mainTemp = null;
      const cores = [];

      for (const [chipName, chipData] of Object.entries(data)) {
        if (!chipData || typeof chipData !== 'object') continue;

        // Intel coretemp
        if (chipName.includes('coretemp')) {
          for (const [key, val] of Object.entries(chipData)) {
            if (key.includes('Package id') || key.includes('SoC')) {
              const temp = val.temp1_input ?? Object.values(val).find(v => typeof v === 'number');
              if (temp !== undefined) {
                mainTemp = Math.round(temp * 10) / 10;
                cores.push({ label: key, temp: mainTemp, max: val.temp1_max, crit: val.temp1_crit });
              }
            } else if (key.startsWith('Core')) {
              const temp = Object.values(val).find(v => typeof v === 'number');
              if (temp !== undefined) {
                cores.push({ label: key, temp: Math.round(temp * 10) / 10 });
              }
            }
          }
        }

        // AMD k10temp / zenpower
        if (chipName.includes('k10temp') || chipName.includes('zenpower')) {
          for (const [key, val] of Object.entries(chipData)) {
            if (key.includes('Tctl') || key.includes('Tdie')) {
              const temp = val.temp1_input ?? val.temp2_input ?? Object.values(val).find(v => typeof v === 'number');
              if (temp !== undefined) {
                mainTemp = Math.round(temp * 10) / 10;
                cores.push({ label: key, temp: mainTemp });
              }
            }
          }
        }

        // ACPI / generic
        if (chipName.includes('acpitz') && mainTemp === null) {
          for (const [key, val] of Object.entries(chipData)) {
            const temp = val.temp1_input ?? Object.values(val).find(v => typeof v === 'number');
            if (temp !== undefined) {
              mainTemp = Math.round(temp * 10) / 10;
              cores.push({ label: 'ACPI', temp: mainTemp });
            }
          }
        }
      }

      // If mainTemp still not resolved, take first available temperature
      if (mainTemp === null && cores.length > 0) {
        mainTemp = cores[0].temp;
      }

      if (mainTemp !== null) {
        return {
          available: true,
          main: mainTemp,
          unit: '°C',
          cores,
          timestamp: Date.now()
        };
      }
    } catch (e) {
      // not valid json or parse error
    }
    return null;
  }

  parseSysfsText(raw) {
    try {
      const lines = raw.trim().split('\n');
      let mainTemp = null;
      const cores = [];
      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length === 2) {
          const type = parts[0].trim();
          const val = parseFloat(parts[1].trim());
          if (!isNaN(val)) {
            const temp = val > 1000 ? Math.round((val / 1000) * 10) / 10 : Math.round(val * 10) / 10;
            if (type.includes('pkg') || type.includes('x86') || type.includes('cpu')) {
              mainTemp = temp;
            }
            cores.push({ label: type, temp });
          }
        }
      }
      if (mainTemp === null && cores.length > 0) mainTemp = cores[0].temp;
      if (mainTemp !== null) {
        return {
          available: true,
          main: mainTemp,
          unit: '°C',
          cores,
          timestamp: Date.now()
        };
      }
    } catch {
      // ignore
    }
    return null;
  }

  fetchViaSsh(config) {
    const { host, port = 22, username = 'root', password, privateKey } = config;
    if (!host || !username || (!password && !privateKey)) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const conn = new Client();
      let resolved = false;

      const finish = (result) => {
        if (!resolved) {
          resolved = true;
          try { conn.end(); } catch {}
          resolve(result);
        }
      };

      const timeout = setTimeout(() => {
        finish(null);
      }, 4000);

      conn.on('ready', () => {
        conn.exec('sensors -j 2>/dev/null || (for z in /sys/class/thermal/thermal_zone*; do echo "$(cat $z/type 2>/dev/null): $(cat $z/temp 2>/dev/null)"; done)', (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            return finish(null);
          }
          let out = '';
          stream.on('data', d => { out += d; });
          stream.on('close', () => {
            clearTimeout(timeout);
            const parsed = this.parseSensorsJson(out) || this.parseSysfsText(out);
            finish(parsed);
          });
        });
      });

      conn.on('error', () => {
        clearTimeout(timeout);
        finish(null);
      });

      try {
        conn.connect({
          host,
          port: Number(port),
          username,
          password: password || undefined,
          privateKey: privateKey || undefined,
          readyTimeout: 4000
        });
      } catch {
        clearTimeout(timeout);
        finish(null);
      }
    });
  }

  async getTemperature(nodeStatus, sshConfig = {}) {
    const now = Date.now();
    if (this.cache && (now - this.lastFetch < this.CACHE_TTL)) {
      return this.cache;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        // 1. Try PVE API nodeStatus.thermalstate (if community mod is present)
        if (nodeStatus?.thermalstate) {
          const parsed = this.parseSensorsJson(nodeStatus.thermalstate) || this.parseSysfsText(nodeStatus.thermalstate);
          if (parsed) {
            parsed.source = 'pve-api';
            this.cache = parsed;
            this.lastFetch = Date.now();
            return parsed;
          }
        }

        // 2. Try SSH probe if credentials provided
        const sshResult = await this.fetchViaSsh(sshConfig);
        if (sshResult) {
          sshResult.source = 'ssh';
          this.cache = sshResult;
          this.lastFetch = Date.now();
          return sshResult;
        }

        // 3. Fallback: Not available
        const fallback = {
          available: false,
          main: null,
          unit: '°C',
          cores: [],
          message: '未检测到温度数据。可配置 SSH 连接或安装 PVE 传感器模块。'
        };
        this.cache = fallback;
        this.lastFetch = Date.now();
        return fallback;
      } finally {
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }
}

export default new ThermalService();
