import React from 'react';
import { Server, RefreshCw, Settings, Search, Sun, Moon } from 'lucide-react';
import { PveVersion } from '../types/pve';

interface HeaderProps {
  version: PveVersion | null;
  nodeName: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  refreshInterval: number;
  onIntervalChange: (interval: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenNodeDetails: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  version,
  nodeName,
  isRefreshing,
  onRefresh,
  refreshInterval,
  onIntervalChange,
  searchQuery,
  onSearchChange,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onOpenNodeDetails
}) => {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20 ring-1 ring-white/20">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Proxmox Pulse
              </h1>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 dark:border-orange-500/30">
                PVE {version?.version || '9.x'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <button 
                onClick={onOpenNodeDetails}
                className="flex items-center gap-1.5 hover:text-orange-600 dark:hover:text-orange-400 transition-colors group"
                title="查看宿主机详细规格与状态"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300 group-hover:text-orange-600 dark:group-hover:text-orange-300">{nodeName}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 underline decoration-slate-300 dark:decoration-slate-600 underline-offset-2">详情</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="搜索虚拟机、容器 (名称、ID、IP)..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700/60 rounded-xl pl-9 pr-4 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Refresh interval selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl p-1 text-xs">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="立即刷新"
              className={`p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-all ${
                isRefreshing ? 'animate-spin text-orange-500' : ''
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <select
              value={refreshInterval}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              className="bg-transparent text-slate-700 dark:text-slate-300 text-xs px-2 py-0.5 focus:outline-none cursor-pointer"
            >
              <option value={3000} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">3s</option>
              <option value={5000} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">5s</option>
              <option value={10000} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">10s</option>
              <option value={30000} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">30s</option>
              <option value={0} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">暂停</option>
            </select>
          </div>

          {/* Settings Modal Button */}
          <button
            onClick={onOpenSettings}
            title="面板设置与连接配置"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            title={isDark ? "切换为浅色模式" : "切换为深色模式"}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};
