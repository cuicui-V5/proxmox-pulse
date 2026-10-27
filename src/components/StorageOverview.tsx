import React, { useState, useEffect } from 'react';
import { HardDrive, Database, ShieldCheck, Thermometer, Clock, Activity, Cpu } from 'lucide-react';
import { StorageInfo, PhysicalDisk } from '../types/pve';
import { formatBytes } from '../utils/formatters';
import { fetchNodeDisks } from '../api/client';

interface StorageOverviewProps {
  storages: StorageInfo[];
  nodeName: string;
}

export const StorageOverview: React.FC<StorageOverviewProps> = ({ storages, nodeName }) => {
  const [disks, setDisks] = useState<PhysicalDisk[]>([]);
  const [loadingDisks, setLoadingDisks] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;
    async function loadDisks() {
      try {
        const res = await fetchNodeDisks(nodeName);
        if (!isCancelled && res.ok && res.disks) {
          setDisks(res.disks);
        }
      } catch (err) {
        console.error('Failed to load physical disks:', err);
      } finally {
        if (!isCancelled) setLoadingDisks(false);
      }
    }
    loadDisks();
    const interval = setInterval(loadDisks, 15000); // 15s poll for disks
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [nodeName]);

  return (
    <div className="space-y-6">
      {/* Section 1: Storage Pools */}
      {storages && storages.length > 0 && (
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">存储池容量监控</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">PVE 节点挂载的存储池容量及使用配额</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storages.map((s) => {
              const used = s.used || 0;
              const total = s.total || 1;
              const percent = total > 0 ? (used / total) * 100 : 0;
              const free = s.avail || (total - used);

              return (
                <div
                  key={s.storage}
                  className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{s.storage}</span>
                    </div>
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                      {s.type}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                      {percent.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {formatBytes(used)} / {formatBytes(total)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        percent > 90 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>可用: {formatBytes(free)}</span>
                    <span className="truncate max-w-[140px]" title={s.content}>内容: {s.content || '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Physical Disks & SMART Monitoring */}
      {disks && disks.length > 0 && (
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">宿主机物理磁盘与 SMART 健康度</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">检测物理磁盘磨损度、盘温与 SMART 运行参数</p>
              </div>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              共 {disks.length} 块磁盘
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disks.map((d) => {
              const isPassed = d.smartHealth === 'PASSED' || d.health === 'PASSED';
              const daysOn = d.powerOnHours ? Math.floor(d.powerOnHours / 24) : null;
              const hasWearout = typeof d.wearout === 'number' && d.wearout >= 0;

              return (
                <div
                  key={d.devpath}
                  className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Devpath, Type, Health */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {d.devpath}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                          {d.type || 'DISK'}
                        </span>
                        {d.used && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {d.used}
                          </span>
                        )}
                      </div>

                      {/* SMART Health Badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          isPassed
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>SMART: {d.smartHealth || d.health || 'OK'}</span>
                      </span>
                    </div>

                    {/* Model & Size */}
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={d.model}>
                        {d.model.replace(/_/g, ' ')}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        容量: {formatBytes(d.size)} • 序列号: {d.serial || '-'}
                      </p>
                    </div>

                    {/* Wearout Progress if SSD */}
                    {hasWearout && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500 dark:text-slate-400">固态磨损寿命剩余</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {d.wearout}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              (d.wearout || 0) < 20
                                ? 'bg-rose-500'
                                : (d.wearout || 0) < 50
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(d.wearout || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Badges footer: Temp & Power on */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-3">
                      {d.temperature !== null && d.temperature !== undefined && (
                        <span className="inline-flex items-center gap-1 font-mono text-orange-600 dark:text-orange-400 font-medium">
                          <Thermometer className="w-3.5 h-3.5" />
                          <span>{d.temperature}°C</span>
                        </span>
                      )}
                      {daysOn !== null && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          <span>通电 {daysOn} 天 ({d.powerOnHours}h)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
