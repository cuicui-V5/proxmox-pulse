import React, { useState } from 'react';
import { Power, RotateCw, Square, RefreshCcw, Copy, Check, Clock, Network, Cpu, MemoryStick, Monitor, Zap } from 'lucide-react';
import { ClusterResource, GuestAction } from '../types/pve';
import { formatBytes, formatUptime } from '../utils/formatters';
import { getOsInfo } from '../utils/osIcons';

interface GuestTableProps {
  guests: ClusterResource[];
  onActionClick: (guest: ClusterResource, action: GuestAction) => void;
  onOpenDetail: (guest: ClusterResource) => void;
  onOpenConsole?: (guest: ClusterResource) => void;
  onToggleOnBoot?: (guest: ClusterResource, nextOnboot: boolean) => void;
}

export const GuestTable: React.FC<GuestTableProps> = ({
  guests,
  onActionClick,
  onOpenDetail,
  onOpenConsole,
  onToggleOnBoot
}) => {
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const copyToClipboard = (e: React.MouseEvent, ip: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-100/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-3 px-4">状态</th>
              <th className="py-3 px-4">ID / 名称</th>
              <th className="py-3 px-4">系统</th>
              <th className="py-3 px-4">IP 地址</th>
              <th className="py-3 px-4">CPU 使用</th>
              <th className="py-3 px-4">内存已用</th>
              <th className="py-3 px-4">运行时间</th>
              <th className="py-3 px-4">自启</th>
              <th className="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {guests.map((guest) => {
              const isRunning = guest.status === 'running';
              const isStopped = guest.status === 'stopped';
              const osInfo = getOsInfo(guest.name);
              const cpuPercent = (guest.cpu || 0) * 100;
              const memUsed = guest.mem || 0;
              const memMax = guest.maxmem || 1;
              const memPercent = (memUsed / memMax) * 100;

              return (
                <tr
                  key={guest.id}
                  onClick={() => onOpenDetail(guest)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  {/* Status dot */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
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
                          isRunning ? 'text-emerald-600 dark:text-emerald-400' : isStopped ? 'text-slate-500 dark:text-slate-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isRunning ? '运行中' : isStopped ? '已关机' : '已暂停'}
                      </span>
                    </div>
                  </td>

                  {/* ID / Name */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        #{guest.vmid}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white hover:text-orange-500 transition-colors">
                        {guest.name}
                      </span>
                    </div>
                  </td>

                  {/* OS */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border ${osInfo.badgeColor}`}>
                      {osInfo.icon}
                      {osInfo.label}
                    </span>
                  </td>

                  {/* IP */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {guest.ips && guest.ips.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        {guest.ips.map((ip) => (
                          <button
                            key={ip}
                            onClick={(e) => copyToClipboard(e, ip)}
                            className="inline-flex items-center gap-1 text-xs font-mono text-sky-700 dark:text-cyan-400 hover:text-sky-800 dark:hover:text-cyan-300 bg-sky-50 dark:bg-slate-950 px-2 py-0.5 rounded border border-sky-200 dark:border-slate-800"
                          >
                            <span>{ip}</span>
                            {copiedIp === ip ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600" />}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-600">-</span>
                    )}
                  </td>

                  {/* CPU */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${isRunning ? Math.min(cpuPercent, 100) : 0}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {isRunning ? `${cpuPercent.toFixed(1)}%` : '0%'}
                      </span>
                    </div>
                  </td>

                  {/* Memory */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${isRunning ? Math.min(memPercent, 100) : 0}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {isRunning ? formatBytes(memUsed, 1) : '-'}
                      </span>
                    </div>
                  </td>

                  {/* Uptime */}
                  <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {isRunning ? formatUptime(guest.uptime) : '已离线'}
                  </td>

                  {/* Auto-start OnBoot */}
                  <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {onToggleOnBoot && (
                      <button
                        onClick={() => onToggleOnBoot(guest, !guest.onboot)}
                        title={guest.onboot ? "开机自启已开启 (点击关闭)" : "未开启自启 (点击开启)"}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                          guest.onboot
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        <span>{guest.onboot ? '开启' : '关闭'}</span>
                      </button>
                    )}
                  </td>

                  {/* Actions */}
                  <td
                    onClick={(e) => e.stopPropagation()}
                    className="py-3 px-4 whitespace-nowrap text-right"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      {isRunning ? (
                        <>
                          {onOpenConsole && (
                            <button
                              onClick={() => onOpenConsole(guest)}
                              title="打开 VNC 控制台"
                              className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30"
                            >
                              <Monitor className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onActionClick(guest, 'shutdown')}
                            title="优雅关机"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700/60"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onActionClick(guest, 'reboot')}
                            title="重启"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700/60"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onActionClick(guest, 'stop')}
                            title="强制断电"
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30"
                          >
                            <Square className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onActionClick(guest, 'reset')}
                            title="强制复位"
                            className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                          >
                            <RefreshCcw className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onActionClick(guest, 'start')}
                          title="开机"
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1"
                        >
                          <Power className="w-3 h-3" />
                          <span>启动</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
