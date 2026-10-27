import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Activity, ArrowDownRight, ArrowUpRight, HardDrive, Wifi, Cpu, MemoryStick } from 'lucide-react';
import { RrdDataPoint, ClusterResource } from '../types/pve';
import { fetchNodeRrd, fetchGuestRrd } from '../api/client';
import { formatBytes, formatRate, formatTimestamp, formatDateTime } from '../utils/formatters';

interface HistoricalChartsProps {
  nodeName: string;
  guests: ClusterResource[];
  isDark: boolean;
}

export const HistoricalCharts: React.FC<HistoricalChartsProps> = ({
  nodeName,
  guests,
  isDark
}) => {
  const [timeframe, setTimeframe] = useState<'hour' | 'day' | 'week' | 'month' | 'year'>('hour');
  const [selectedTarget, setSelectedTarget] = useState<string>('node'); // 'node' or 'qemu/101'
  const [data, setData] = useState<RrdDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        let result: RrdDataPoint[] = [];
        if (selectedTarget === 'node') {
          result = await fetchNodeRrd(nodeName, timeframe);
        } else {
          const [type, vmidStr] = selectedTarget.split('/');
          const vmid = parseInt(vmidStr, 10);
          result = await fetchGuestRrd(nodeName, type, vmid, timeframe);
        }
        if (!isCancelled) {
          setData(result);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || '加载历史性能数据失败');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    const timer = setInterval(loadData, 30000);
    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [nodeName, timeframe, selectedTarget]);

  // Format timestamps for X axis
  const timeLabels = useMemo(() => {
    return data.map(pt => {
      return timeframe === 'hour' ? formatTimestamp(pt.time) : formatDateTime(pt.time);
    });
  }, [data, timeframe]);

  // Calculate current & peak stats
  const cpuValues = data.map(pt => (pt.cpu ? pt.cpu * 100 : 0));
  const peakCpu = cpuValues.length > 0 ? Math.max(...cpuValues).toFixed(1) : '0';
  const latestCpu = cpuValues.length > 0 ? cpuValues[cpuValues.length - 1].toFixed(1) : '0';

  // Dynamic Theme options based on isDark
  const baseChartTheme = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      grid: { top: 30, right: 15, bottom: 25, left: 45 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
        axisPointer: { type: 'cross', lineStyle: { color: '#ea580c', width: 1, type: 'dashed' } }
      },
      xAxis: {
        type: 'category',
        data: timeLabels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        axisLabel: { color: isDark ? '#64748b' : '#64748b', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: isDark ? '#1e293b' : '#f1f5f9' } },
        axisLabel: { color: '#64748b', fontSize: 11 }
      }
    };
  }, [isDark, timeLabels]);

  // 1. CPU Chart Option
  const cpuChartOption = useMemo(() => ({
    ...baseChartTheme,
    tooltip: {
      ...baseChartTheme.tooltip,
      formatter: (params: any) => {
        if (!params || !params[0]) return '';
        const idx = params[0].dataIndex;
        let html = `<div class="font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'} pb-1">${timeLabels[idx]}</div>`;
        params.forEach((item: any) => {
          html += `<div class="flex items-center justify-between gap-4 py-0.5">
            <span class="flex items-center gap-1.5">${item.marker} ${item.seriesName}</span>
            <span class="font-mono font-semibold">${Number(item.value).toFixed(2)}%</span>
          </div>`;
        });
        return html;
      }
    },
    yAxis: {
      ...baseChartTheme.yAxis,
      min: 0,
      axisLabel: { formatter: '{value}%', color: '#64748b' }
    },
    series: [
      {
        name: 'CPU 使用率',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.map(pt => (pt.cpu ? (pt.cpu * 100) : 0)),
        lineStyle: { width: 2, color: '#f97316' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(249, 115, 22, 0.3)' },
              { offset: 1, color: 'rgba(249, 115, 22, 0.0)' }
            ]
          }
        }
      },
      ...(data[0]?.iowait !== undefined ? [{
        name: 'IO 等待 (iowait)',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.map(pt => (pt.iowait ? (pt.iowait * 100) : 0)),
        lineStyle: { width: 1.5, color: '#ef4444', type: 'dashed' }
      }] : [])
    ]
  }), [baseChartTheme, data, isDark, timeLabels]);

  // 2. Memory Chart Option
  const memChartOption = useMemo(() => ({
    ...baseChartTheme,
    tooltip: {
      ...baseChartTheme.tooltip,
      formatter: (params: any) => {
        if (!params || !params[0]) return '';
        const idx = params[0].dataIndex;
        let html = `<div class="font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'} pb-1">${timeLabels[idx]}</div>`;
        params.forEach((item: any) => {
          html += `<div class="flex items-center justify-between gap-4 py-0.5">
            <span class="flex items-center gap-1.5">${item.marker} ${item.seriesName}</span>
            <span class="font-mono font-semibold">${formatBytes(item.value)}</span>
          </div>`;
        });
        return html;
      }
    },
    yAxis: {
      ...baseChartTheme.yAxis,
      min: 0,
      axisLabel: {
        formatter: (val: number) => formatBytes(val, 0),
        color: '#64748b'
      }
    },
    series: [
      {
        name: '内存已用 (RAM Used)',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.map(pt => pt.memused || pt.mem || 0),
        lineStyle: { width: 2, color: '#10b981' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' }
            ]
          }
        }
      },
      {
        name: '内存配额 (Total RAM)',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.map(pt => pt.memtotal || pt.maxmem || 0),
        lineStyle: { width: 1, color: isDark ? '#64748b' : '#94a3b8', type: 'dashed' }
      }
    ]
  }), [baseChartTheme, data, isDark, timeLabels]);

  // 3. Network Traffic Chart Option
  const netChartOption = useMemo(() => ({
    ...baseChartTheme,
    tooltip: {
      ...baseChartTheme.tooltip,
      formatter: (params: any) => {
        if (!params || !params[0]) return '';
        const idx = params[0].dataIndex;
        let html = `<div class="font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'} pb-1">${timeLabels[idx]}</div>`;
        params.forEach((item: any) => {
          html += `<div class="flex items-center justify-between gap-4 py-0.5">
            <span class="flex items-center gap-1.5">${item.marker} ${item.seriesName}</span>
            <span class="font-mono font-semibold">${formatRate(item.value)}</span>
          </div>`;
        });
        return html;
      }
    },
    yAxis: {
      ...baseChartTheme.yAxis,
      min: 0,
      axisLabel: {
        formatter: (val: number) => formatRate(val, 0),
        color: '#64748b'
      }
    },
    series: [
      {
        name: '网络流入 (Inbound / Rx)',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.map(pt => pt.netin || 0),
        lineStyle: { width: 2, color: '#0284c7' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(2, 132, 199, 0.25)' },
              { offset: 1, color: 'rgba(2, 132, 199, 0.0)' }
            ]
          }
        }
      },
      {
        name: '网络流出 (Outbound / Tx)',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.map(pt => pt.netout || 0),
        lineStyle: { width: 2, color: '#6366f1' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99, 102, 241, 0.25)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0.0)' }
            ]
          }
        }
      }
    ]
  }), [baseChartTheme, data, isDark, timeLabels]);

  // 4. Disk IO Chart Option
  const diskChartOption = useMemo(() => ({
    ...baseChartTheme,
    tooltip: {
      ...baseChartTheme.tooltip,
      formatter: (params: any) => {
        if (!params || !params[0]) return '';
        const idx = params[0].dataIndex;
        let html = `<div class="font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'} pb-1">${timeLabels[idx]}</div>`;
        params.forEach((item: any) => {
          html += `<div class="flex items-center justify-between gap-4 py-0.5">
            <span class="flex items-center gap-1.5">${item.marker} ${item.seriesName}</span>
            <span class="font-mono font-semibold">${formatRate(item.value)}</span>
          </div>`;
        });
        return html;
      }
    },
    yAxis: {
      ...baseChartTheme.yAxis,
      min: 0,
      axisLabel: {
        formatter: (val: number) => formatRate(val, 0),
        color: '#64748b'
      }
    },
    series: [
      {
        name: '磁盘读取 (Disk Read)',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.map(pt => pt.diskread || 0),
        lineStyle: { width: 2, color: '#d97706' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(217, 119, 6, 0.25)' },
              { offset: 1, color: 'rgba(217, 119, 6, 0.0)' }
            ]
          }
        }
      },
      {
        name: '磁盘写入 (Disk Write)',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.map(pt => pt.diskwrite || 0),
        lineStyle: { width: 2, color: '#db2777' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(219, 39, 119, 0.25)' },
              { offset: 1, color: 'rgba(219, 39, 119, 0.0)' }
            ]
          }
        }
      }
    ]
  }), [baseChartTheme, data, isDark, timeLabels]);

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
      {/* Header controls: Target selector + Timeframe buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              历史性能监控
              {loading && <span className="text-xs text-orange-500 dark:text-orange-400 font-normal animate-pulse">(更新中...)</span>}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">实时读取 PVE RRD 高精度历史性能引擎数据</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Target Entity Selector */}
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
          >
            <option value="node">宿主机 ({nodeName})</option>
            {guests.map((g) => (
              <option key={g.id} value={`${g.type}/${g.vmid}`}>
                {g.type.toUpperCase()} #{g.vmid} - {g.name}
              </option>
            ))}
          </select>

          {/* Timeframe Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl p-1 text-xs">
            {(['hour', 'day', 'week', 'month', 'year'] as const).map((tf) => {
              const labelMap = {
                hour: '1小时',
                day: '24小时',
                week: '7天',
                month: '30天',
                year: '1年'
              };
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                    active
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700/50'
                  }`}
                >
                  {labelMap[tf]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
          <p className="text-rose-500 dark:text-rose-400 mb-1">{error}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">无法拉取所选时段的监控数据</p>
        </div>
      ) : (
        /* 4 Charts Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. CPU */}
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">CPU 使用率 & IO 等待</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>当前: <strong className="text-slate-900 dark:text-white">{latestCpu}%</strong></span>
                <span>峰值: <strong className="text-orange-600 dark:text-orange-400">{peakCpu}%</strong></span>
              </div>
            </div>
            <div className="h-56">
              <ReactECharts
                option={cpuChartOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          </div>

          {/* 2. Memory */}
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MemoryStick className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">内存占用变化</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                已用 vs 配额
              </div>
            </div>
            <div className="h-56">
              <ReactECharts
                option={memChartOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          </div>

          {/* 3. Network Traffic */}
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-sky-500 dark:text-cyan-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">网络吞吐流量速率</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1 text-sky-600 dark:text-cyan-400">
                  <ArrowDownRight className="w-3 h-3" /> 流入 (Rx)
                </span>
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <ArrowUpRight className="w-3 h-3" /> 流出 (Tx)
                </span>
              </div>
            </div>
            <div className="h-56">
              <ReactECharts
                option={netChartOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          </div>

          {/* 4. Disk IO */}
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">磁盘读写速率</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">读取 (Read)</span>
                <span className="flex items-center gap-1 text-pink-600 dark:text-pink-400">写入 (Write)</span>
              </div>
            </div>
            <div className="h-56">
              <ReactECharts
                option={diskChartOption}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'canvas' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
