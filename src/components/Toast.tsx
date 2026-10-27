import React from 'react';
import { CheckCircle2, AlertCircle, Info, Loader2, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  title: string;
  description?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
          info: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />,
          loading: <Loader2 className="w-5 h-5 text-orange-400 shrink-0 mt-0.5 animate-spin" />
        };

        const borderMap = {
          success: 'border-emerald-500/40 bg-slate-900/95',
          error: 'border-rose-500/40 bg-slate-900/95',
          info: 'border-blue-500/40 bg-slate-900/95',
          loading: 'border-orange-500/40 bg-slate-900/95'
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border shadow-xl flex items-start justify-between gap-3 backdrop-blur-md animate-slide-up transition-all ${borderMap[toast.type]}`}
          >
            <div className="flex items-start gap-3">
              {iconMap[toast.type]}
              <div>
                <div className="text-sm font-semibold text-white">{toast.title}</div>
                {toast.description && (
                  <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {toast.description}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
