import React from 'react';
import { AlertTriangle, Power, RotateCw, Square, RefreshCcw, X, Loader2 } from 'lucide-react';
import { ClusterResource, GuestAction } from '../types/pve';

interface ActionConfirmModalProps {
  isOpen: boolean;
  guest: ClusterResource | null;
  action: GuestAction | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ActionConfirmModal: React.FC<ActionConfirmModalProps> = ({
  isOpen,
  guest,
  action,
  isLoading,
  onConfirm,
  onCancel
}) => {
  if (!isOpen || !guest || !action) return null;

  const isDestructive = action === 'stop' || action === 'reset';

  const actionConfig: Record<
    GuestAction,
    { title: string; desc: string; icon: React.ReactNode; confirmText: string; btnColor: string }
  > = {
    start: {
      title: '启动虚拟机',
      desc: `即将启动 ${guest.type.toUpperCase()} #${guest.vmid} (${guest.name})，系统将加载并进入就绪状态。`,
      icon: <Power className="w-6 h-6 text-emerald-500" />,
      confirmText: '立即启动',
      btnColor: 'bg-emerald-600 hover:bg-emerald-500 text-white'
    },
    shutdown: {
      title: '优雅关机 (ACPI Shutdown)',
      desc: `将向虚拟机 #${guest.vmid} (${guest.name}) 发送 ACPI 关机信号，操作系统将正常保存数据并安全关闭。`,
      icon: <Power className="w-6 h-6 text-amber-500" />,
      confirmText: '发送关机信号',
      btnColor: 'bg-amber-600 hover:bg-amber-500 text-white'
    },
    reboot: {
      title: '系统重启 (Reboot)',
      desc: `将向虚拟机 #${guest.vmid} (${guest.name}) 发送软重启信号，系统将重新引导。`,
      icon: <RotateCw className="w-6 h-6 text-blue-500" />,
      confirmText: '确认重启',
      btnColor: 'bg-blue-600 hover:bg-blue-500 text-white'
    },
    stop: {
      title: '强制关机 (Stop / 断电)',
      desc: `注意：强制关机相当于直接切断虚拟机电源！虚拟机内未保存的数据可能会丢失或导致文件系统损坏。`,
      icon: <Square className="w-6 h-6 text-rose-500" />,
      confirmText: '强制断电关机',
      btnColor: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
    },
    reset: {
      title: '强制复位 (Reset)',
      desc: `注意：强制复位相当于按下物理机机箱 Reset 键！可能会导致虚拟机内存中未写入磁盘的数据丢失。`,
      icon: <RefreshCcw className="w-6 h-6 text-rose-500" />,
      confirmText: '强制复位',
      btnColor: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
    },
    suspend: {
      title: '暂停虚拟机',
      desc: `将挂起虚拟机 #${guest.vmid} 的运行状态。`,
      icon: <Power className="w-6 h-6 text-amber-500" />,
      confirmText: '确认暂停',
      btnColor: 'bg-amber-600 hover:bg-amber-500 text-white'
    },
    resume: {
      title: '恢复虚拟机',
      desc: `将恢复虚拟机 #${guest.vmid} 的运行。`,
      icon: <Power className="w-6 h-6 text-emerald-500" />,
      confirmText: '立即恢复',
      btnColor: 'bg-emerald-600 hover:bg-emerald-500 text-white'
    }
  };

  const current = actionConfig[action];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with icon */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-xl ${isDestructive ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
            {current.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{current.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              目标: <span className="text-slate-800 dark:text-slate-200 font-mono">#{guest.vmid} ({guest.name})</span>
            </p>
          </div>
        </div>

        {/* Warning Callout if destructive */}
        {isDestructive && (
          <div className="flex items-start gap-3 p-3.5 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <p>{current.desc}</p>
          </div>
        )}

        {!isDestructive && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            {current.desc}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-all ${current.btnColor}`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{current.confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
