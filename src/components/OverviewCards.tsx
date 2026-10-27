import React from 'react';
import { Cpu, MemoryStick as Memory, HardDrive, Layers, Thermometer, Flame } from 'lucide-react';
import { NodeStatus, StorageInfo, CpuThermalInfo } from '../types/pve';
import { formatBytes } from '../utils/formatters';

interface OverviewCardsProps {
  nodeStatus: NodeStatus | null;
  storages: StorageInfo[];
  thermal?: CpuThermalInfo | null;
  summary: {
    totalGuests: number;
    runningGuests: number;
    stoppedGuests: number;
    pausedGuests: number;
    qemuCount: number;
    lxcCount: number;
  };
  filterStatus: string;
  onSelectFilter: (status: string) => void;
  onOpenNodeDetails: () => void;
  onOpenSettings: () => void;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  nodeStatus,
  storages,
  thermal,
  summary,
  filterStatus,
  onSelectFilter,
  onOpenNodeDetails,
  onOpenSettings
}) => {
  // Calculations
  const cpuPercent = (nodeStatus?.cpu || 0) * 100;
  
  const memUsed = nodeStatus?.memory?.used || 0;
  const memTotal = nodeStatus?.memory?.total || 1;
  const memPercent = (memUsed / memTotal) * 100;

  const rootUsed = nodeStatus?.rootfs?.used || 0;
  const rootTotal = nodeStatus?.rootfs?.total || 1;
  const rootPercent = (rootUsed / rootTotal) * 100;

  // Total storage from all pools
  const totalStorageBytes = storages.reduce((acc, s) => acc + (s.total || 0), 0);
  const usedStorageBytes = storages.reduce((acc, s) => acc + (s.used || 0), 0);
  const storagePercent = totalStorageBytes > 0 ? (usedStorageBytes / totalStorageBytes) * 100 : 0;

  // Thermal status
  const hasTemp = thermal?.available && thermal.main !== null;
  const mainTemp = thermal?.main ?? null;
  const tempColor = mainTemp === null 
    ? 'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
    : mainTemp < 55 
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
    : mainTemp < 75 
    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
    : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. CPU Card */}
      <div 
        onClick={onOpenNodeDetails}
        className="group relative bg-white dark:bg-slate-900/90 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">CPU 使用率</span>
          </div>

          {/* CPU Temperature Badge */}
          {hasTemp ? (
            <div 
              className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${tempColor}`}
              title={`CPU 温度: ${mainTemp}°C\n${thermal?.cores?.map(c => `${c.label}: ${c.temp}°C`).join('\n') || ''}`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{mainTemp?.toFixed(1)}°C</span>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
              title="未检测到温度数据，点击查看开启指引"
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 border border-slate-200 dark:border-slate-700"
            >
              <Thermometer className="w-3 h-3" />
              <span>测温待配</span>
            </button>
          )}
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
            {cpuPercent.toFixed(1)}%
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <div>负载: {nodeStatus?.loadavg?.join(' ') || '0.00 0.00 0.00'}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              cpuPercent > 80 ? 'bg-rose-500' : cpuPercent > 50 ? 'bg-amber-500' : 'bg-orange-500'
            }`}
            style={{ width: `${Math.min(cpuPercent, 100)}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate max-w-[150px]" title={nodeStatus?.cpuinfo?.model}>
            {nodeStatus?.cpuinfo?.model || 'Intel Processor'}
          </span>
          <span className="font-mono">{nodeStatus?.cpuinfo?.cores || 1} 核</span>
        </div>
      </div>

      {/* 2. Memory Card */}
      <div 
        onClick={onOpenNodeDetails}
        className="group relative bg-white dark:bg-slate-900/90 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Memory className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">内存占用</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {formatBytes(memTotal)}
          </span>
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
            {memPercent.toFixed(1)}%
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <div>已用: {formatBytes(memUsed)}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              memPercent > 90 ? 'bg-rose-500' : memPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(memPercent, 100)}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>空闲: {formatBytes(nodeStatus?.memory?.free || 0)}</span>
          <span>Swap: {formatBytes(nodeStatus?.swap?.used || 0)}</span>
        </div>
      </div>

      {/* 3. Storage Pools Card */}
      <div 
        onClick={onOpenNodeDetails}
        className="group relative bg-white dark:bg-slate-900/90 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">存储池容量</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {storages.length} 个存储池
          </span>
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
            {storagePercent.toFixed(1)}%
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <div>已用: {formatBytes(usedStorageBytes)}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              storagePercent > 90 ? 'bg-rose-500' : storagePercent > 70 ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${Math.min(storagePercent, 100)}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>总容量: {formatBytes(totalStorageBytes)}</span>
          <span>根目录: {rootPercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* 4. Guests / Status Card */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">虚拟机与容器</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            共 {summary.totalGuests} 台
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {/* Running button/badge */}
          <button
            onClick={() => onSelectFilter(filterStatus === 'running' ? 'all' : 'running')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-center transition-all ${
              filterStatus === 'running'
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 ring-1 ring-emerald-400/30'
                : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-emerald-500/20'
            }`}
          >
            <div className="text-xl font-bold font-mono">{summary.runningGuests}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">运行中</div>
          </button>

          {/* Stopped button/badge */}
          <button
            onClick={() => onSelectFilter(filterStatus === 'stopped' ? 'all' : 'stopped')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-center transition-all ${
              filterStatus === 'stopped'
                ? 'bg-slate-200 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/40'
            }`}
          >
            <div className="text-xl font-bold font-mono">{summary.stoppedGuests}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">已停止</div>
          </button>

          {summary.pausedGuests > 0 && (
            <button
              onClick={() => onSelectFilter(filterStatus === 'paused' ? 'all' : 'paused')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-center transition-all ${
                filterStatus === 'paused'
                  ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                  : 'bg-slate-50 dark:bg-slate-800/80 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-amber-500/20'
              }`}
            >
              <div className="text-xl font-bold font-mono">{summary.pausedGuests}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">暂停</div>
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>QEMU 虚拟机: {summary.qemuCount}</span>
          <span>LXC 容器: {summary.lxcCount}</span>
        </div>
      </div>
    </div>
  );
};
