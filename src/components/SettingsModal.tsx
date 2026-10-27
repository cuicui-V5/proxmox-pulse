import React, { useState, useEffect } from 'react';
import { X, Settings, CheckCircle2, AlertCircle, Loader2, Thermometer, ShieldCheck } from 'lucide-react';
import { fetchConfig, saveConfig } from '../api/client';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  if (!isOpen) return null;

  const [host, setHost] = useState('');
  const [port, setPort] = useState(8006);
  const [tokenId, setTokenId] = useState('');
  const [tokenSecret, setTokenSecret] = useState('');
  const [verifySsl, setVerifySsl] = useState(false);

  // SSH settings
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchConfig();
        if (res.ok && res.config) {
          setHost(res.config.host || '');
          setPort(res.config.port || 8006);
          setTokenId(res.config.tokenId || '');
          setVerifySsl(res.config.verifySsl || false);
          setSshHost(res.config.sshHost || res.config.host || '');
          setSshPort(res.config.sshPort || 22);
          setSshUser(res.config.sshUser || 'root');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const payload: any = {
        host,
        port: Number(port),
        tokenId,
        verifySsl,
        sshHost: sshHost || host,
        sshPort: Number(sshPort),
        sshUser
      };
      if (tokenSecret) {
        payload.tokenSecret = tokenSecret;
      }
      if (sshPassword) {
        payload.sshPassword = sshPassword;
      }
      const res = await saveConfig(payload);
      if (res.ok) {
        setStatusMsg({ type: 'success', text: `连接成功！已连接到 PVE ${res.version?.version || '9.x'}` });
        onConfigSaved();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatusMsg({ type: 'error', text: res.error || '连接 PVE 失败' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || '请求失败' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">面板设置与连接配置</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">适配任意 Proxmox VE 节点，支持随时修改接入端点与传感器凭证</p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span>读取当前设置...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-1">
            {/* Section 1: PVE API */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                <span>PVE REST API 端点与凭证</span>
              </h4>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    PVE 主机 IP 或域名
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.2.5"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    端口
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    placeholder="8006"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  API Token ID
                </label>
                <input
                  type="text"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="root@pam!dashboard"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  API Token Secret (UUID 密钥)
                </label>
                <input
                  type="password"
                  value={tokenSecret}
                  onChange={(e) => setTokenSecret(e.target.value)}
                  placeholder="若无需修改请留空"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="verifySsl"
                  checked={verifySsl}
                  onChange={(e) => setVerifySsl(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-800 text-orange-500 focus:ring-orange-500 bg-white dark:bg-slate-950"
                />
                <label htmlFor="verifySsl" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  验证 SSL 证书 (若为自签名证书请取消勾选)
                </label>
              </div>
            </div>

            {/* Section 2: SSH Thermal Sensor */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-orange-500" />
                <span>CPU 温度传感器探针配置 (可选)</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                填写 PVE 宿主机 SSH 登录凭据后，面板将自动安全采集 CPU 温度（支持 Intel/AMD/ACPI 传感器）
              </p>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    SSH 主机 IP
                  </label>
                  <input
                    type="text"
                    value={sshHost}
                    onChange={(e) => setSshHost(e.target.value)}
                    placeholder={host || "192.168.2.5"}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    SSH 端口
                  </label>
                  <input
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(Number(e.target.value))}
                    placeholder="22"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    SSH 用户名
                  </label>
                  <input
                    type="text"
                    value={sshUser}
                    onChange={(e) => setSshUser(e.target.value)}
                    placeholder="root"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    SSH 密码
                  </label>
                  <input
                    type="password"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    placeholder="若无需修改请留空"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-orange-500 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Quick Helper for Friends */}
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-xs text-orange-900 dark:text-orange-300 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <span>💡 快捷指引：在任意 PVE 生成 API Token</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-orange-200/80 mb-1">
                在 PVE 终端执行一行命令即可生成专用 Token：
              </div>
              <code className="block bg-white dark:bg-slate-950 px-2 py-1 rounded text-orange-600 dark:text-orange-300 font-mono select-all">
                pveum user token add root@pam dashboard --privsep 0
              </code>
            </div>

            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
                }`}
              >
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-sm"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>测试并保存连接</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
