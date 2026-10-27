import React, { useState } from 'react';
import { X, Power, RotateCw, AlertTriangle, Loader2 } from 'lucide-react';
import { executeNodeAction } from '../api/client';

interface HostPowerModalProps {
  isOpen: boolean;
  nodeName: string;
  onClose: () => void;
  onSuccess: (action: 'reboot' | 'shutdown') => void;
}

export const HostPowerModal: React.FC<HostPowerModalProps> = ({
  isOpen,
  nodeName,
  onClose,
  onSuccess
}) => {
  if (!isOpen) return null;

  const [selectedAction, setSelectedAction] = useState<'reboot' | 'shutdown'>('reboot');
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmInput.trim().toLowerCase() === nodeName.trim().toLowerCase();

  const handleExecute = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await executeNodeAction(nodeName, selectedAction);
      if (res.ok) {
        onSuccess(selectedAction);
        onClose();
      } else {
        setError(res.error || '执行宿主机电源操作失败');
      }
    } catch (err: any) {
      setError(err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">PVE 宿主机电源管理</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              目标节点: <strong className="font-mono text-slate-700 dark:text-slate-300">{nodeName}</strong>
            </p>
          </div>
        </div>

        {/* Action Type Selection */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setSelectedAction('reboot')}
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              selectedAction === 'reboot'
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <RotateCw className="w-4 h-4 text-blue-500" />
            <span>重启宿主机</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAction('shutdown')}
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              selectedAction === 'shutdown'
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
                : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <Power className="w-4 h-4 text-rose-500" />
            <span>关闭宿主机</span>
          </button>
        </div>

        {/* Warning text */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed mb-4">
          ⚠️ 警告：对物理宿主机执行 {selectedAction === 'reboot' ? '重启' : '关机'} 会导致该节点上<strong>所有运行中的虚拟机与容器一并停止运行</strong>并中断现有网络连接。
        </div>

        {/* Safety Input Confirmation */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            防误触确认：请输入节点名称 <strong className="font-mono text-orange-600 dark:text-orange-400 select-all">{nodeName}</strong>
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={`在此输入 ${nodeName}`}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
          />
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Bottom Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!isConfirmed || loading}
            onClick={handleExecute}
            className={`px-4 py-2 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm ${
              !isConfirmed
                ? 'opacity-40 cursor-not-allowed bg-slate-400 dark:bg-slate-700'
                : selectedAction === 'reboot'
                ? 'bg-blue-600 hover:bg-blue-500'
                : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>确认{selectedAction === 'reboot' ? '重启' : '关机'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
