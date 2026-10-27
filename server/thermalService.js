class ThermalService {
  constructor() {
    this.cache = null;
    this.lastFetch = 0;
    this.CACHE_TTL = 3000; // 3s cache
  }

  parseSensorsJson(raw) {
    if (!raw) return null;
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
          source: 'pve-api',
          timestamp: Date.now()
        };
      }
    } catch {
      // not valid json or parse error
    }
    return null;
  }

  async getTemperature(nodeStatus) {
    // Check if nodeStatus has thermalstate from PVE native REST API hook
    if (nodeStatus?.thermalstate) {
      const parsed = this.parseSensorsJson(nodeStatus.thermalstate);
      if (parsed) {
        this.cache = parsed;
        this.lastFetch = Date.now();
        return parsed;
      }
    }

    // If cached within TTL, return cached
    const now = Date.now();
    if (this.cache && (now - this.lastFetch < this.CACHE_TTL)) {
      return this.cache;
    }

    // Default fallback: Not enabled on PVE
    return {
      available: false,
      main: null,
      unit: '°C',
      cores: [],
      source: 'pve-api',
      message: '未开启 PVE 原生测温扩展。在 PVE 执行单行命令即可秒级启用。'
    };
  }
}

export default new ThermalService();
