import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Maximize2, Minimize2, RotateCw, Terminal as TerminalIcon, Loader2, AlertCircle } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { requestHostTermProxy } from '../api/client';

interface HostShellModalProps {
  isOpen: boolean;
  nodeName: string;
  onClose: () => void;
}

export const HostShellModal: React.FC<HostShellModalProps> = ({
  isOpen,
  nodeName,
  onClose
}) => {
  if (!isOpen) return null;

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [reconnectKey, setReconnectKey] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const handleReconnect = () => {
    setReconnectKey((k) => k + 1);
  };

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

  useEffect(() => {
    let isCancelled = false;
    let pingInterval: any = null;

    // Clean up previous
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (termRef.current) {
      try { termRef.current.dispose(); } catch {}
      termRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    setStatus('connecting');
    setErrorMessage(null);

    async function initShell() {
      try {
        const proxyRes = await requestHostTermProxy(nodeName);
        if (isCancelled) return;

        if (!proxyRes.ok || !proxyRes.ticket || !proxyRes.port) {
          throw new Error(proxyRes.error || '获取 PVE 宿主机终端会话失败');
        }

        const { port, ticket, user } = proxyRes;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/term-ws?node=${encodeURIComponent(nodeName)}&port=${port}&ticket=${encodeURIComponent(ticket)}&user=${encodeURIComponent(user || '')}`;

        if (!containerRef.current || isCancelled) return;

        // Create xterm
        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: 13,
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          theme: {
            background: '#090d16',
            foreground: '#e2e8f0',
            cursor: '#f97316',
            selectionBackground: 'rgba(249, 115, 22, 0.3)',
            black: '#1e293b',
            red: '#f43f5e',
            green: '#10b981',
            yellow: '#f59e0b',
            blue: '#3b82f6',
            magenta: '#ec4899',
            cyan: '#06b6d4',
            white: '#f8fafc',
            brightBlack: '#475569',
            brightRed: '#fb7185',
            brightGreen: '#34d399',
            brightYellow: '#fbbf24',
            brightBlue: '#60a5fa',
            brightMagenta: '#f472b6',
            brightCyan: '#22d3ee',
            brightWhite: '#ffffff'
          }
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();

        termRef.current = term;
        fitAddonRef.current = fitAddon;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let authDone = false;

        ws.onopen = () => {
          // Connected to proxy
        };

        ws.onmessage = async (event) => {
          let text = '';
          if (typeof event.data === 'string') {
            text = event.data;
          } else if (event.data instanceof Blob) {
            text = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            text = new TextDecoder().decode(event.data);
          }

          if (text === '{"type":"ready"}') {
            authDone = true;
            if (!isCancelled) {
              setStatus('connected');
              try { fitAddon.fit(); } catch {}
              term.focus();
              // Notify PVE termproxy of terminal dimensions: 1:cols:rows:
              ws.send(`1:${term.cols}:${term.rows}:`);
              // Send ping every 30s to keep alive
              pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send('2');
                }
              }, 30000);
            }
            return;
          }

          if (!authDone && text.startsWith('OK')) {
            authDone = true;
            if (!isCancelled) {
              setStatus('connected');
              try { fitAddon.fit(); } catch {}
              term.focus();
              // Notify PVE termproxy of terminal dimensions: 1:cols:rows:
              ws.send(`1:${term.cols}:${term.rows}:`);
              // Send ping every 30s to keep alive
              pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send('2');
                }
              }, 30000);
            }
            const rest = text.replace(/^OK\r?\n?/, '');
            if (rest.length > 0) {
              term.write(rest);
            }
            return;
          }

          if (!authDone && !isCancelled) {
            authDone = true;
            setStatus('connected');
            try { fitAddon.fit(); } catch {}
            term.focus();
            ws.send(`1:${term.cols}:${term.rows}:`);
            pingInterval = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send('2');
              }
            }, 30000);
          }

          term.write(text);
        };

        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            const bytes = new TextEncoder().encode(data);
            ws.send(`0:${bytes.length}:${data}`);
          }
        });

        term.onResize((size) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(`1:${size.cols}:${size.rows}:`);
          }
        });

        ws.onclose = () => {
          if (!isCancelled) {
            setStatus('disconnected');
          }
        };

        ws.onerror = () => {
          if (!isCancelled) {
            setStatus('error');
            setErrorMessage('宿主机 WebSocket 终端连接异常');
          }
        };

        // Resize observer
        const ro = new ResizeObserver(() => {
          try {
            fitAddon.fit();
          } catch {}
        });
        if (containerRef.current) {
          ro.observe(containerRef.current);
        }

      } catch (err: any) {
        if (!isCancelled) {
          setStatus('error');
          setErrorMessage(err.message || '连接宿主机终端失败');
        }
      }
    }

    initShell();

    return () => {
      isCancelled = true;
      if (pingInterval) clearInterval(pingInterval);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      if (termRef.current) {
        try { termRef.current.dispose(); } catch {}
        termRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [nodeName, reconnectKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        className={`relative flex flex-col bg-[#090d16] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none border-none' : 'w-full max-w-5xl h-[80vh]'
        }`}
      >
        {/* Header Bar */}
        <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between text-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 cursor-pointer" onClick={onClose} />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 cursor-pointer" onClick={toggleFullscreen} />
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
              <TerminalIcon className="w-4 h-4 text-orange-400" />
              <span className="font-mono text-xs font-semibold text-white">
                root@{nodeName} (PVE Host Shell)
              </span>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700">
              {status === 'connecting' && (
                <>
                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-amber-400">正在连接终端...</span>
                </>
              )}
              {status === 'connected' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400">已就绪 (xterm.js)</span>
                </>
              )}
              {status === 'disconnected' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-slate-400">会话已结束</span>
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleReconnect}
              title="重新连接终端"
              className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? '退出全屏' : '全屏终端'}
              className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal viewport */}
        <div className="relative flex-1 bg-[#090d16] p-2 overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />

          {/* Overlays */}
          {status === 'connecting' && (
            <div className="absolute inset-0 bg-[#090d16]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-slate-400 z-10">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              <span className="text-xs font-mono">正在分配 PVE 伪终端会话 (PTY)...</span>
            </div>
          )}

          {(status === 'disconnected' || status === 'error') && (
            <div className="absolute inset-0 bg-[#090d16]/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-slate-300 z-10 p-4">
              <AlertCircle className="w-7 h-7 text-amber-400" />
              <div className="text-sm font-semibold">{status === 'error' ? '终端连接失败' : '终端会话已断开'}</div>
              {errorMessage && <p className="text-xs text-slate-400 max-w-sm text-center">{errorMessage}</p>}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleReconnect}
                  className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>重新打开会话</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  关闭
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
