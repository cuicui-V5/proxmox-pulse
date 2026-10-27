import React from 'react';
import { X, Server, Cpu, MemoryStick, HardDrive, Flame } from 'lucide-react';
import { NodeStatus, StorageInfo, PveVersion, CpuThermalInfo } from '../types/pve';
import { formatBytes, formatUptime } from '../utils/formatters';

interface NodeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeStatus: NodeStatus | null;
  storages: StorageInfo[];
  version: PveVersion | null;
  thermal?: CpuThermalInfo | null;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({
  isOpen,
  onClose,
  nodeStatus,
  storages,
  version,
  thermal
}) => {
  if (!isOpen || !nodeStatus) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">宿主机系统规格</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-orange-600 dark:text-orange-400 border border-slate-300 dark:border-slate-700 font-semibold">
                  {nodeStatus.node}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Proxmox VE {version?.version || nodeStatus.pveversion} • 运行时间: {formatUptime(nodeStatus.uptime)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* CPU & Thermal Sensors */}
          <div>
            <h4 className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-500 dark:text-orange-400" />
              <span>处理器与温度传感器</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400">CPU 型号</div>
                <div className="font-semibold text-slate-900 dark:text-white mt-1">{nodeStatus.cpuinfo?.model || 'Intel'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400">核心架构</div>
                <div className="font-semibold text-slate-900 dark:text-white mt-1">
                  {nodeStatus.cpuinfo?.sockets || 1} 物理槽位 • {nodeStatus.cpuinfo?.cores || 4} 核心 ({nodeStatus.cpuinfo?.mhz || 2000} MHz)
                </div>
              </div>

              {/* Temperature breakdown if available */}
              {thermal?.available && thermal.main !== null && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 sm:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-orange-500" />
                      核心温度分布 (PVE REST API)
                    </span>
                    <span className="font-mono font-bold text-orange-600 dark:text-orange-400 text-sm">
                      Package: {thermal.main}°C
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    {thermal.cores?.map((c, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between items-center font-mono">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">{c.label}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{c.temp}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 sm:col-span-2">
                <div className="text-slate-500 dark:text-slate-400">系统内核</div>
                <div className="font-mono text-slate-800 dark:text-slate-200 mt-1 truncate" title={nodeStatus.kversion}>
                  {nodeStatus.kversion}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400">系统负载 (Load Average)</div>
                <div className="font-mono font-semibold text-orange-600 dark:text-orange-400 mt-1">
                  {nodeStatus.loadavg?.join('  ') || '0.00 0.00 0.00'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400">IO 延迟 / 等待</div>
                <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  {((nodeStatus.wait || 0) * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Memory Breakdown */}
          <div>
            <h4 className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider mb-3 flex items-center gap-2">
              <MemoryStick className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>内存与交换分区 (RAM & Swap)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400">物理内存总量</div>
                <div className="font-bold text-slate-900 dark:text-white text-sm mt-1">{formatBytes(nodeStatus.memory?.total)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400">内存已用</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-1">{formatBytes(nodeStatus.memory?.used)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400">可用空闲内存</div>
                <div className="font-bold text-slate-700 dark:text-slate-300 text-sm mt-1">{formatBytes(nodeStatus.memory?.available || nodeStatus.memory?.free)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <div className="text-slate-500 dark:text-slate-400">Swap 交换空间</div>
                <div className="font-bold text-slate-700 dark:text-slate-300 text-sm mt-1">
                  {formatBytes(nodeStatus.swap?.used)} / {formatBytes(nodeStatus.swap?.total)}
                </div>
              </div>
            </div>
          </div>

          {/* Storage Pools Table */}
          <div>
            <h4 className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
              <span>存储池挂载状况 ({storages.length})</span>
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">名称</th>
                    <th className="py-2.5 px-3">类型</th>
                    <th className="py-2.5 px-3">总容量</th>
                    <th className="py-2.5 px-3">已使用</th>
                    <th className="py-2.5 px-3">使用率</th>
                    <th className="py-2.5 px-3">存储内容</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {storages.map((s) => {
                    const percent = s.total ? ((s.used || 0) / s.total) * 100 : 0;
                    return (
                      <tr key={s.storage} className="hover:bg-slate-100/60 dark:hover:bg-slate-900/50">
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white font-mono">{s.storage}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 uppercase">{s.type}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{formatBytes(s.total)}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{formatBytes(s.used)}</td>
                        <td className="py-2 px-3 font-mono">
                          <span className={percent > 85 ? 'text-rose-500 font-bold' : 'text-cyan-600 dark:text-cyan-400'}>
                            {percent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 truncate max-w-xs">{s.content || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
