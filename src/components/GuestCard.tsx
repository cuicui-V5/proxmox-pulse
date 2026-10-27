import React, { useState } from 'react';
import { Power, RotateCw, Square, RefreshCcw, Copy, Check, Clock, Network, Cpu, MemoryStick, ChevronRight } from 'lucide-react';
import { ClusterResource, GuestAction } from '../types/pve';
import { formatBytes, formatUptime } from '../utils/formatters';
import { getOsInfo } from '../utils/osIcons';

interface GuestCardProps {
  guest: ClusterResource;
  onActionClick: (guest: ClusterResource, action: GuestAction) => void;
  onOpenDetail: (guest: ClusterResource) => void;
}

export const GuestCard: React.FC<GuestCardProps> = ({
  guest,
  onActionClick,
  onOpenDetail
}) => {
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const isRunning = guest.status === 'running';
  const isStopped = guest.status === 'stopped';

  const osInfo = getOsInfo(guest.name);

  const cpuPercent = (guest.cpu || 0) * 100;
  const memUsed = guest.mem || 0;
  const memMax = guest.maxmem || 1;
  const memPercent = (memUsed / memMax) * 100;

  const copyToClipboard = (e: React.MouseEvent, ip: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  return (
    <div
      onClick={() => onOpenDetail(guest)}
      className="group relative bg-white dark:bg-slate-900/90 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
    >
      {/* Top row: Badges & status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* VMID Badge */}
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              #{guest.vmid}
            </span>

            {/* Type Badge */}
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50">
              {guest.type}
            </span>

            {/* OS Badge */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border ${osInfo.badgeColor}`}>
              {osInfo.icon}
              {osInfo.label}
            </span>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? 'bg-emerald-500 animate-pulse'
                  : isStopped
                  ? 'bg-slate-400 dark:bg-slate-500'
                  : 'bg-amber-500'
              }`}
            />
            <span
              className={`text-xs font-medium ${
                isRunning
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isStopped
                  ? 'text-slate-500 dark:text-slate-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isRunning ? '运行中' : isStopped ? '已关机' : '已暂停'}
            </span>
          </div>
        </div>

        {/* Guest Name & Node */}
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors flex items-center justify-between">
            <span className="truncate">{guest.name || `VM ${guest.vmid}`}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {isRunning ? formatUptime(guest.uptime) : '已停止'}
            </span>
          </div>
        </div>

        {/* IP Address Pill */}
        {guest.ips && guest.ips.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {guest.ips.map((ip) => (
              <button
                key={ip}
                onClick={(e) => copyToClipboard(e, ip)}
                title="点击复制 IP 地址"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-slate-950/80 hover:bg-sky-100 dark:hover:bg-slate-800 border border-sky-200 dark:border-slate-700/60 text-xs font-mono text-sky-700 dark:text-cyan-400 transition-colors"
              >
                <Network className="w-3.5 h-3.5 text-sky-500 dark:text-cyan-500" />
                <span>{ip}</span>
                {copiedIp === ip ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-4 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
            <span>{isRunning ? '未分配或 Agent 待命' : '未运行'}</span>
          </div>
        )}

        {/* Resource Bars */}
        <div className="space-y-3 mb-5">
          {/* CPU Bar */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Cpu className="w-3.5 h-3.5" />
                CPU ({guest.maxcpu || 1} 核)
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {isRunning ? `${cpuPercent.toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  cpuPercent > 80 ? 'bg-rose-500' : 'bg-orange-500'
                }`}
                style={{ width: `${isRunning ? Math.min(cpuPercent, 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Memory Bar */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <MemoryStick className="w-3.5 h-3.5" />
                内存
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {isRunning ? `${formatBytes(memUsed, 1)} / ${formatBytes(memMax, 1)}` : formatBytes(memMax, 1)}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  memPercent > 85 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${isRunning ? Math.min(memPercent, 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
      >
        {isRunning ? (
          <>
            {/* Graceful Shutdown */}
            <button
              onClick={() => onActionClick(guest, 'shutdown')}
              title="优雅关机 (ACPI Shutdown)"
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Power className="w-3.5 h-3.5 text-amber-500" />
              <span>关机</span>
            </button>

            {/* Reboot */}
            <button
              onClick={() => onActionClick(guest, 'reboot')}
              title="重启 (Reboot)"
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-500" />
              <span>重启</span>
            </button>

            {/* Force Stop */}
            <button
              onClick={() => onActionClick(guest, 'stop')}
              title="强制断电 (Stop)"
              className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
            </button>

            {/* Reset */}
            <button
              onClick={() => onActionClick(guest, 'reset')}
              title="强制复位 (Reset)"
              className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 transition-colors"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          /* Start Button */
          <button
            onClick={() => onActionClick(guest, 'start')}
            title="开机 (Start)"
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Power className="w-4 h-4" />
            <span>开启虚拟机</span>
          </button>
        )}
      </div>
    </div>
  );
};
