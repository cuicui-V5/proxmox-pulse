import React, { useState, useEffect } from 'react';
import { X, Power, RotateCw, Square, Cpu, MemoryStick, HardDrive, Network, Clock, Monitor } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { ClusterResource, GuestDetail, GuestAction, RrdDataPoint } from '../types/pve';
import { fetchGuestDetail, fetchGuestRrd } from '../api/client';
import { formatBytes, formatRate, formatUptime, formatTimestamp, formatDateTime } from '../utils/formatters';
import { getOsInfo } from '../utils/osIcons';

interface GuestDetailModalProps {
  isOpen: boolean;
  guest: ClusterResource | null;
  onClose: () => void;
  onActionClick: (guest: ClusterResource, action: GuestAction) => void;
  onOpenConsole?: (guest: ClusterResource) => void;
}

export const GuestDetailModal: React.FC<GuestDetailModalProps> = ({
  isOpen,
  guest,
  onClose,
  onActionClick,
  onOpenConsole
}) => {
  if (!isOpen || !guest) return null;

  const [detail, setDetail] = useState<GuestDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'network'>('overview');
  const [timeframe, setTimeframe] = useState<'hour' | 'day' | 'week'>('hour');
  const [rrdData, setRrdData] = useState<RrdDataPoint[]>([]);

  const isRunning = guest.status === 'running';
  const osInfo = getOsInfo(guest.name);

  useEffect(() => {
    let isCancelled = false;
    async function load() {
      if (!guest) return;
      setLoading(true);
      try {
        const [d, rrd] = await Promise.all([
          fetchGuestDetail(guest.node, guest.type, guest.vmid).catch(() => null),
          fetchGuestRrd(guest.node, guest.type, guest.vmid, timeframe).catch(() => [])
        ]);
        if (!isCancelled) {
          setDetail(d);
          setRrdData(rrd);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    load();
    return () => {
      isCancelled = true;
    };
  }, [guest, timeframe]);

  // Chart data
  const timeLabels = rrdData.map(pt =>
    timeframe === 'hour' ? formatTimestamp(pt.time) : formatDateTime(pt.time)
  );

  const miniChartTheme = {
    backgroundColor: 'transparent',
    grid: { top: 25, right: 10, bottom: 20, left: 40 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      textStyle: { color: '#0f172a', fontSize: 11 }
    },
    xAxis: {
      type: 'category',
      data: timeLabels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#64748b', fontSize: 10 }
    }
  };

  const cpuOption = {
    ...miniChartTheme,
    yAxis: { ...miniChartTheme.yAxis, axisLabel: { formatter: '{value}%', color: '#64748b' } },
    series: [{
      name: 'CPU',
      type: 'line',
      showSymbol: false,
      smooth: true,
      data: rrdData.map(pt => (pt.cpu ? pt.cpu * 100 : 0)),
      lineStyle: { width: 2, color: '#f97316' },
      areaStyle: { color: 'rgba(249, 115, 22, 0.2)' }
    }]
  };

  const memOption = {
    ...miniChartTheme,
    yAxis: {
      ...miniChartTheme.yAxis,
      axisLabel: { formatter: (val: number) => formatBytes(val, 0), color: '#64748b' }
    },
    series: [{
      name: '内存已用',
      type: 'line',
      showSymbol: false,
      smooth: true,
      data: rrdData.map(pt => pt.mem || 0),
      lineStyle: { width: 2, color: '#10b981' },
      areaStyle: { color: 'rgba(16, 185, 129, 0.2)' }
    }]
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-xl border ${osInfo.badgeColor}`}>
              {osInfo.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  #{guest.vmid}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{guest.name}</h2>
                <span className="text-xs text-slate-500 uppercase">{guest.type}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span>{isRunning ? `运行中 (${formatUptime(guest.uptime)})` : '已停止'}</span>
                <span>• 节点: {guest.node}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2">
            {isRunning && onOpenConsole && (
              <button
                onClick={() => onOpenConsole(guest)}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>控制台</span>
              </button>
            )}

            {isRunning ? (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <button
                  onClick={() => onActionClick(guest, 'shutdown')}
                  title="优雅关机"
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>关机</span>
                </button>
                <button
                  onClick={() => onActionClick(guest, 'reboot')}
                  title="重启"
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>重启</span>
                </button>
                <button
                  onClick={() => onActionClick(guest, 'stop')}
                  title="强制断电"
                  className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onActionClick(guest, 'start')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                <span>开机</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-6 text-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'overview'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            概览与实时监控
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'config'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            硬件规格与配置
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`py-3 border-b-2 font-medium transition-colors ${
              activeTab === 'network'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            网络与 IP 详情 ({detail?.agentInterfaces?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Cpu className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                    <span>CPU 核心</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {detail?.config?.cores || guest.maxcpu || 1} 核
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    使用率: {((guest.cpu || 0) * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <MemoryStick className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <span>内存配额</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {formatBytes(guest.maxmem, 1)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    已用: {formatBytes(guest.mem, 1)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <HardDrive className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    <span>主磁盘</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {formatBytes(guest.maxdisk, 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    读: {formatRate(guest.diskread)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Clock className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span>运行时间</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {isRunning ? formatUptime(guest.uptime) : '离线'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    QEMU Guest Agent: {detail?.config?.agent === '1' || detail?.status?.agent ? '已启用' : '未开启'}
                  </div>
                </div>
              </div>

              {/* Historical Performance for this VM */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">虚拟机历史性能趋势</h4>
                  <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg text-xs">
                    {(['hour', 'day', 'week'] as const).map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-2 py-0.5 rounded ${timeframe === tf ? 'bg-orange-500 text-white font-medium' : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'}`}
                      >
                        {tf === 'hour' ? '1小时' : tf === 'day' ? '24小时' : '7天'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">CPU 历史趋势 (%)</div>
                    <div className="h-44">
                      <ReactECharts option={cpuOption} style={{ height: '100%', width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">内存历史趋势 (MB/GB)</div>
                    <div className="h-44">
                      <ReactECharts option={memOption} style={{ height: '100%', width: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {detail?.config ? (
                Object.entries(detail.config).map(([key, val]) => (
                  <div key={key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="font-mono text-slate-500 dark:text-slate-400">{key}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-[220px]" title={String(val)}>
                      {String(val)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-slate-400 text-xs">暂无配置数据</div>
              )}
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-4">
              {detail?.agentInterfaces && detail.agentInterfaces.length > 0 ? (
                detail.agentInterfaces.map((iface, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{iface.name}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        MAC: {iface['hardware-address'] || 'N/A'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {iface['ip-addresses']?.map((addr, aIdx) => (
                        <div
                          key={aIdx}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200"
                        >
                          <span className="text-slate-400 mr-1.5 uppercase">{addr['ip-address-type']}</span>
                          <span className={addr['ip-address-type'] === 'ipv4' ? 'text-sky-600 dark:text-cyan-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                            {addr['ip-address']}
                          </span>
                          {addr.prefix && <span className="text-slate-400">/{addr.prefix}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Network className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p>未获取到 QEMU Guest Agent 网络接口信息</p>
                  <p className="text-[11px] text-slate-500 mt-1">请确认虚拟机已安装并运行 qemu-guest-agent 守护程序</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
