import React from 'react';
import { HardDrive, Database } from 'lucide-react';
import { StorageInfo } from '../types/pve';
import { formatBytes } from '../utils/formatters';

interface StorageOverviewProps {
  storages: StorageInfo[];
}

export const StorageOverview: React.FC<StorageOverviewProps> = ({ storages }) => {
  if (!storages || storages.length === 0) return null;

  return (
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
  );
};
