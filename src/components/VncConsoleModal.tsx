import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  RotateCw,
  Terminal,
  Loader2,
  AlertCircle,
  Keyboard,
  Monitor,
  Scaling,
  ClipboardPaste,
  ChevronDown,
  Check
} from 'lucide-react';
import RFB from '@novnc/novnc';
import { ClusterResource } from '../types/pve';
import { requestVncProxy } from '../api/client';
import { getOsInfo } from '../utils/osIcons';

interface VncConsoleModalProps {
  isOpen: boolean;
  guest: ClusterResource | null;
  onClose: () => void;
}

export const VncConsoleModal: React.FC<VncConsoleModalProps> = ({
  isOpen,
  guest,
  onClose
}) => {
  if (!isOpen || !guest) return null;

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scaleViewport, setScaleViewport] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showKeysMenu, setShowKeysMenu] = useState<boolean>(false);
  const [showClipboard, setShowClipboard] = useState<boolean>(false);
  const [clipboardText, setClipboardText] = useState<string>('');
  const [clipboardSent, setClipboardSent] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [reconnectKey, setReconnectKey] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);
  const scaleViewportRef = useRef<boolean>(scaleViewport);
  const typingTimerRef = useRef<any>(null);

  const osInfo = getOsInfo(guest.name);

  // Synchronize scaleViewportRef
  scaleViewportRef.current = scaleViewport;

  useEffect(() => {
    let isCancelled = false;
    let localRfb: RFB | null = null;

    async function initVnc() {
      if (!guest || !containerRef.current) return;

      // Clean up previous instance
      if (rfbRef.current) {
        try {
          rfbRef.current.disconnect();
        } catch {}
        rfbRef.current = null;
      }

      // Purge any existing DOM children
      containerRef.current.innerHTML = '';
      setStatus('connecting');
      setErrorMessage(null);

      try {
        const ticketRes = await requestVncProxy(guest.node, guest.type, guest.vmid);

        // If component unmounted or effect re-ran while waiting for ticket, abort immediately!
        if (isCancelled || !containerRef.current) return;

        if (!ticketRes.ok || !ticketRes.ticket || !ticketRes.port) {
          throw new Error(ticketRes.error || '获取 VNC 票据失败，请确认虚拟机处于运行状态');
        }

        // Clean container again right before appending canvas to guarantee single viewport
        containerRef.current.innerHTML = '';

        const { ticket, port, password } = ticketRes;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/vnc-ws?node=${guest.node}&type=${guest.type}&vmid=${guest.vmid}&port=${port}&ticket=${encodeURIComponent(ticket)}`;

        localRfb = new RFB(containerRef.current, wsUrl, {
          credentials: { password }
        });

        if (isCancelled) {
          localRfb.disconnect();
          return;
        }

        localRfb.scaleViewport = scaleViewportRef.current;
        localRfb.resizeSession = false;
        localRfb.focusOnClick = true;

        localRfb.addEventListener('connect', () => {
          if (!isCancelled) {
            setStatus('connected');
            setErrorMessage(null);
          }
        });

        localRfb.addEventListener('disconnect', (e: any) => {
          if (!isCancelled) {
            setStatus('disconnected');
            if (e.detail && e.detail.clean === false) {
              setErrorMessage('VNC 会话已意外终止');
            }
          }
        });

        localRfb.addEventListener('securityfailure', (e: any) => {
          if (!isCancelled) {
            setStatus('error');
            setErrorMessage(e.detail?.reason || 'VNC 安全握手认证失败');
          }
        });

        rfbRef.current = localRfb;
      } catch (err: any) {
        if (!isCancelled) {
          setStatus('error');
          setErrorMessage(err.message || '连接控制台失败');
        }
      }
    }

    initVnc();

    return () => {
      isCancelled = true;
      if (localRfb) {
        try {
          localRfb.disconnect();
        } catch {}
      }
      if (rfbRef.current) {
        try {
          rfbRef.current.disconnect();
        } catch {}
        rfbRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [guest?.node, guest?.type, guest?.vmid, reconnectKey]);

  // Handle Scale Toggle without re-running connection!
  const toggleScaling = () => {
    const next = !scaleViewport;
    setScaleViewport(next);
    scaleViewportRef.current = next;
    if (rfbRef.current) {
      rfbRef.current.scaleViewport = next;
    }
  };

  // Reconnect trigger
  const handleReconnect = () => {
    setReconnectKey((prev) => prev + 1);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
      modalRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Send Keys
  const sendCtrlAltDel = () => {
    if (rfbRef.current && status === 'connected') {
      rfbRef.current.sendCtrlAltDel();
    }
  };

  const sendSpecialKey = (keysym: number, code: string) => {
    if (rfbRef.current && status === 'connected') {
      rfbRef.current.sendKey(keysym, code, true);
      setTimeout(() => {
        rfbRef.current?.sendKey(keysym, code, false);
      }, 50);
    }
    setShowKeysMenu(false);
  };

  // 1. Simulate Typing directly into the active screen (works 100% in all consoles/shells/terminals)
  const handleTypeToScreen = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rfbRef.current || status !== 'connected' || !clipboardText) return;
    const rfb = rfbRef.current;

    // Also sync the clipboard buffer if possible
    try {
      rfb.clipboardPasteFrom(clipboardText);
    } catch {}

    // Focus canvas
    try {
      rfb.focus();
    } catch {}

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    setIsTyping(true);

    const cleanText = clipboardText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let idx = 0;

    const typeNext = () => {
      if (idx >= cleanText.length) {
        setIsTyping(false);
        setClipboardSent(true);
        setTimeout(() => {
          setClipboardSent(false);
          setShowClipboard(false);
          setClipboardText('');
        }, 1200);
        return;
      }

      const ch = cleanText[idx];
      idx++;

      let keysym = ch.charCodeAt(0);
      if (ch === '\n') {
        keysym = 0xff0d; // XK_Return
      } else if (ch === '\t') {
        keysym = 0xff09; // XK_Tab
      } else if (ch === '\b') {
        keysym = 0xff08; // XK_BackSpace
      } else if (keysym > 255) {
        // Standard X11 Unicode Keysym
        keysym = 0x01000000 | ch.codePointAt(0)!;
      }

      try {
        rfb.sendKey(keysym);
      } catch (err) {
        console.error('Error typing character:', err);
      }

      typingTimerRef.current = setTimeout(typeNext, 12);
    };

    typeNext();
  };

  // 2. Sync to Guest OS Clipboard buffer (for VMs with desktop clipboard services)
  const handleSyncClipboardOnly = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (rfbRef.current && clipboardText) {
      rfbRef.current.clipboardPasteFrom(clipboardText);
      setClipboardSent(true);
      setTimeout(() => {
        setClipboardSent(false);
        setShowClipboard(false);
        setClipboardText('');
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        className={`relative flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full rounded-none border-none'
            : 'w-full max-w-6xl h-[88vh]'
        }`}
      >
        {/* Header Toolbar */}
        <div className="px-4 py-2.5 bg-slate-800/95 border-b border-slate-700/80 flex items-center justify-between gap-3 text-slate-200 shrink-0">
          {/* Left: Guest info & connection status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
              <Monitor className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                #{guest.vmid}
              </span>
              <span className="font-semibold text-sm text-white truncate">
                {guest.name}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-slate-700 bg-slate-800 text-slate-300">
                {osInfo.icon}
                {osInfo.label}
              </span>
            </div>

            {/* Status Indicator */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700/60 text-xs">
              {status === 'connecting' && (
                <>
                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-amber-400">正在建立连接...</span>
                </>
              )}
              {status === 'connected' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-medium">已连接 (RFB/VNC)</span>
                </>
              )}
              {status === 'disconnected' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-slate-400">连接已断开</span>
                </>
              )}
              {status === 'error' && (
                <>
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  <span className="text-rose-400">连接失败</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Ctrl + Alt + Del */}
            <button
              onClick={sendCtrlAltDel}
              disabled={status !== 'connected'}
              title="发送 Ctrl + Alt + Del 组合键"
              className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700 text-xs font-mono font-medium text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <Keyboard className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Ctrl+Alt+Del</span>
            </button>

            {/* Extra Keys Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowKeysMenu(!showKeysMenu)}
                disabled={status !== 'connected'}
                title="常用按键"
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700 text-xs text-slate-200 transition-colors flex items-center gap-1"
              >
                <Terminal className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showKeysMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 text-xs z-50 animate-fade-in"
                  onMouseLeave={() => setShowKeysMenu(false)}
                >
                  <button
                    onClick={() => sendSpecialKey(0xff1b, 'Escape')}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700 text-slate-200 flex justify-between items-center"
                  >
                    <span>Escape (Esc)</span>
                    <span className="font-mono text-[10px] text-slate-400">Esc</span>
                  </button>
                  <button
                    onClick={() => sendSpecialKey(0xff09, 'Tab')}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700 text-slate-200 flex justify-between items-center"
                  >
                    <span>Tab 制表键</span>
                    <span className="font-mono text-[10px] text-slate-400">Tab</span>
                  </button>
                  <button
                    onClick={() => sendSpecialKey(0xffeb, 'MetaLeft')}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700 text-slate-200 flex justify-between items-center"
                  >
                    <span>Windows / Super 键</span>
                    <span className="font-mono text-[10px] text-slate-400">Win</span>
                  </button>
                  <div className="my-1 border-t border-slate-700" />
                  <button
                    onClick={() => sendSpecialKey(0xffbe, 'F1')}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700 text-slate-200 flex justify-between items-center"
                  >
                    <span>F1 (帮助/引导)</span>
                    <span className="font-mono text-[10px] text-slate-400">F1</span>
                  </button>
                  <button
                    onClick={() => sendSpecialKey(0xffc9, 'F12')}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-700 text-slate-200 flex justify-between items-center"
                  >
                    <span>F12 (启动菜单)</span>
                    <span className="font-mono text-[10px] text-slate-400">F12</span>
                  </button>
                </div>
              )}
            </div>

            {/* Clipboard text sender */}
            <button
              onClick={() => setShowClipboard(!showClipboard)}
              disabled={status !== 'connected'}
              title="发送剪贴板文本到远程"
              className={`p-1.5 rounded-lg border transition-colors ${
                showClipboard
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : 'bg-slate-700 hover:bg-slate-600 border-transparent text-slate-200 disabled:opacity-40'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>

            {/* Scale toggle */}
            <button
              onClick={toggleScaling}
              title={scaleViewport ? '切换至原始 1:1 分辨率' : '切换至自适应窗口缩放'}
              className={`p-1.5 rounded-lg border transition-colors ${
                scaleViewport
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : 'bg-slate-700 hover:bg-slate-600 border-transparent text-slate-200'
              }`}
            >
              <Scaling className="w-3.5 h-3.5" />
            </button>

            {/* Reconnect */}
            <button
              onClick={handleReconnect}
              title="重新连接控制台"
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? '退出全屏' : '全屏显示控制台'}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Clipboard drawer / popup */}
        {showClipboard && (
          <div className="p-3 bg-slate-800 border-b border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
            <span className="text-slate-400 shrink-0 flex items-center gap-1">
              <Keyboard className="w-3.5 h-3.5 text-orange-400" />
              <span>发送文本:</span>
            </span>
            <input
              type="text"
              value={clipboardText}
              onChange={(e) => setClipboardText(e.target.value)}
              placeholder="在此输入命令、密码或文本（按回车直接键入虚拟机）..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-orange-500 font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTypeToScreen(e);
              }}
              autoFocus
            />
            <div className="flex items-center gap-1.5 shrink-0 justify-end">
              <button
                type="button"
                onClick={() => handleTypeToScreen()}
                disabled={isTyping || !clipboardText.trim()}
                title="模拟键盘按键直接将文本敲入虚拟机屏幕（适用于所有终端、Shell 及登录界面）"
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Keyboard className="w-3.5 h-3.5" />}
                <span>{isTyping ? '正在键入...' : '键入屏幕 (推荐)'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSyncClipboardOnly()}
                disabled={!clipboardText.trim()}
                title="写入虚拟机系统剪切板（需虚拟机内运行有桌面环境及剪贴板同步服务，支持进入虚拟机后按 Ctrl+V 粘贴）"
                className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 font-medium inline-flex items-center gap-1 transition-colors"
              >
                {clipboardSent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
                <span>{clipboardSent ? '已同步' : '同步剪贴板'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Viewport canvas container */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-auto select-none">
          {/* noVNC Canvas Target */}
          <div
            ref={containerRef}
            className="w-full h-full flex items-center justify-center cursor-default outline-none"
            tabIndex={0}
          />

          {/* Overlay: Connecting */}
          {status === 'connecting' && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-slate-300 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <div className="text-sm font-medium">正在建立 PVE 控制台连接...</div>
              <p className="text-xs text-slate-500 font-mono">
                {guest.name} (#{guest.vmid}) • 正在初始化 VNC Proxy
              </p>
            </div>
          )}

          {/* Overlay: Error or Disconnected */}
          {(status === 'disconnected' || status === 'error') && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-3">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                {status === 'error' ? '控制台连接失败' : '控制台连接已断开'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mb-4">
                {errorMessage || '无法与虚拟机建立稳定的 RFB 视频流。请检查虚拟机是否正常运行。'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReconnect}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-md"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>重新连接</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  关闭窗口
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
