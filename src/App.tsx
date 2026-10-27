import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LayoutGrid, List, AlertCircle, Layers } from 'lucide-react';
import { Header } from './components/Header';
import { OverviewCards } from './components/OverviewCards';
import { HistoricalCharts } from './components/HistoricalCharts';
import { GuestCard } from './components/GuestCard';
import { GuestTable } from './components/GuestTable';
import { StorageOverview } from './components/StorageOverview';
import { ActionConfirmModal } from './components/ActionConfirmModal';
import { GuestDetailModal } from './components/GuestDetailModal';
import { NodeDetailsModal } from './components/NodeDetailsModal';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer, ToastMessage } from './components/Toast';

import {
  fetchOverview,
  fetchGuests,
  executeGuestAction,
  pollTaskStatus
} from './api/client';
import {
  ClusterResource,
  NodeStatus,
  StorageInfo,
  PveVersion,
  GuestAction,
  ActionModalState,
  CpuThermalInfo
} from './types/pve';

export const App: React.FC = () => {
  // Theme state: default to LIGHT mode as requested!
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('pve_theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pve_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pve_theme', 'light');
    }
  }, [isDark]);

  // Data states
  const [version, setVersion] = useState<PveVersion | null>(null);
  const [primaryNode, setPrimaryNode] = useState<string>('pve');
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [storages, setStorages] = useState<StorageInfo[]>([]);
  const [thermal, setThermal] = useState<CpuThermalInfo | null>(null);
  const [summary, setSummary] = useState({
    totalGuests: 0,
    runningGuests: 0,
    stoppedGuests: 0,
    pausedGuests: 0,
    qemuCount: 0,
    lxcCount: 0
  });
  const [guests, setGuests] = useState<ClusterResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search & View Mode states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all', 'running', 'stopped', 'qemu', 'lxc'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);

  // Modals state
  const [actionModal, setActionModal] = useState<ActionModalState>({
    isOpen: false,
    guest: null,
    action: null,
    isDestructive: false
  });
  const [isActionExecuting, setIsActionExecuting] = useState<boolean>(false);

  const [detailGuest, setDetailGuest] = useState<ClusterResource | null>(null);
  const [isNodeDetailsOpen, setIsNodeDetailsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    if (toast.type !== 'loading') {
      setTimeout(() => {
        dismissToast(id);
      }, 4000);
    }
    return id;
  };

  const updateToast = (id: string, updates: Partial<ToastMessage>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    if (updates.type && updates.type !== 'loading') {
      setTimeout(() => {
        dismissToast(id);
      }, 4000);
    }
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Main data loader
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const [overviewData, guestsData] = await Promise.all([
        fetchOverview(),
        fetchGuests()
      ]);

      if (overviewData.ok) {
        setVersion(overviewData.version);
        setPrimaryNode(overviewData.primaryNode);
        setNodeStatus(overviewData.nodeStatus);
        setStorages(overviewData.storages || []);
        setThermal(overviewData.thermal || null);
        setSummary(overviewData.summary);
      }

      setGuests(guestsData);
      setError(null);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || '连接 Proxmox VE 失败');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling effect
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(() => {
      loadData(true);
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, loadData]);

  // Filtered Guests
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      // Status & type filter
      if (filterStatus === 'running' && g.status !== 'running') return false;
      if (filterStatus === 'stopped' && g.status !== 'stopped') return false;
      if (filterStatus === 'paused' && g.status !== 'paused') return false;
      if (filterStatus === 'qemu' && g.type !== 'qemu') return false;
      if (filterStatus === 'lxc' && g.type !== 'lxc') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (g.name || '').toLowerCase().includes(q);
        const matchesId = String(g.vmid).includes(q);
        const matchesIp = (g.ips || []).some((ip) => ip.includes(q));
        return matchesName || matchesId || matchesIp;
      }

      return true;
    });
  }, [guests, filterStatus, searchQuery]);

  // Trigger Action Confirmation Modal
  const handleOpenActionModal = (guest: ClusterResource, action: GuestAction) => {
    setActionModal({
      isOpen: true,
      guest,
      action,
      isDestructive: action === 'stop' || action === 'reset'
    });
  };

  // Confirm and execute action
  const handleConfirmAction = async () => {
    const { guest, action } = actionModal;
    if (!guest || !action) return;

    setIsActionExecuting(true);
    const actionNames: Record<GuestAction, string> = {
      start: '启动',
      shutdown: '关机',
      stop: '强制断电',
      reboot: '重启',
      reset: '强制复位',
      suspend: '暂停',
      resume: '恢复'
    };
    const toastId = addToast({
      type: 'loading',
      title: `正在执行 ${actionNames[action]}...`,
      description: `向 ${guest.type.toUpperCase()} #${guest.vmid} (${guest.name}) 发送指令`
    });

    try {
      const res = await executeGuestAction(guest.node, guest.type, guest.vmid!, action);
      if (!res.ok) throw new Error(res.error || '执行操作失败');

      setActionModal({ isOpen: false, guest: null, action: null, isDestructive: false });

      // If task UPID returned, poll task status
      if (res.upid) {
        let attempts = 0;
        const maxAttempts = 30; // 30s max
        const poll = async () => {
          attempts++;
          try {
            const task = await pollTaskStatus(guest.node, res.upid!);
            if (task.ok && task.status?.status === 'stopped') {
              const success = task.status.exitstatus === 'OK';
              updateToast(toastId, {
                type: success ? 'success' : 'error',
                title: success ? `${actionNames[action]}已完成` : `${actionNames[action]}未成功`,
                description: `${guest.name} (${task.status.exitstatus || 'OK'})`
              });
              loadData(true);
              return;
            }
          } catch {
            // ignore
          }

          if (attempts < maxAttempts) {
            setTimeout(poll, 1000);
          } else {
            updateToast(toastId, {
              type: 'info',
              title: `${actionNames[action]}指令已发送`,
              description: '任务在后台继续执行'
            });
            loadData(true);
          }
        };
        setTimeout(poll, 1000);
      } else {
        updateToast(toastId, {
          type: 'success',
          title: `${actionNames[action]}指令已发出`,
          description: `${guest.name}`
        });
        loadData(true);
      }
    } catch (err: any) {
      updateToast(toastId, {
        type: 'error',
        title: `${actionNames[action]}失败`,
        description: err.message
      });
    } finally {
      setIsActionExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Navbar Header */}
      <Header
        version={version}
        nodeName={primaryNode}
        isRefreshing={isRefreshing}
        onRefresh={() => loadData(false)}
        refreshInterval={refreshInterval}
        onIntervalChange={setRefreshInterval}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNodeDetails={() => setIsNodeDetailsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error banner if backend can't connect */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <div className="font-semibold">尚未连接到 Proxmox VE 节点</div>
                <div className="text-xs text-rose-600 dark:text-rose-400/80 mt-0.5">{error}</div>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shrink-0 shadow-sm transition-all"
            >
              配置 PVE 连接
            </button>
          </div>
        )}

        {/* 1. Overview Metric Cards */}
        <OverviewCards
          nodeStatus={nodeStatus}
          storages={storages}
          thermal={thermal}
          summary={summary}
          filterStatus={filterStatus}
          onSelectFilter={setFilterStatus}
          onOpenNodeDetails={() => setIsNodeDetailsOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* 2. Historical Performance Metrics */}
        <HistoricalCharts
          nodeName={primaryNode}
          guests={guests}
          isDark={isDark}
        />

        {/* 3. Virtual Machines & Containers Management */}
        <div className="space-y-4">
          {/* Controls Bar: Filter tabs & View toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs overflow-x-auto max-w-full shadow-sm">
              {[
                { id: 'all', label: '全部', count: summary.totalGuests },
                { id: 'running', label: '运行中', count: summary.runningGuests },
                { id: 'stopped', label: '已停止', count: summary.stoppedGuests },
                { id: 'qemu', label: 'QEMU 虚拟机', count: summary.qemuCount },
                { id: 'lxc', label: 'LXC 容器', count: summary.lxcCount }
              ].map((tab) => {
                const active = filterStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilterStatus(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all inline-flex items-center gap-1.5 whitespace-nowrap ${
                      active
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      active ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="网格卡片视图"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="列表表格视图"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Guest Cards / Table */}
          {filteredGuests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-sm">
              <Layers className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
              <div className="text-base font-semibold text-slate-700 dark:text-slate-300">没有匹配的虚拟机或容器</div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">请尝试修改筛选条件或搜索关键词</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGuests.map((guest) => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  onActionClick={handleOpenActionModal}
                  onOpenDetail={setDetailGuest}
                />
              ))}
            </div>
          ) : (
            <GuestTable
              guests={filteredGuests}
              onActionClick={handleOpenActionModal}
              onOpenDetail={setDetailGuest}
            />
          )}
        </div>

        {/* 4. Storage Pools Section */}
        <StorageOverview storages={storages} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-white dark:bg-slate-950 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-400">Proxmox Pulse</span>
            <span>• 现代简约 PVE 性能监控与虚拟机管理面板</span>
          </div>
          <div>
            <span>Node: <strong className="text-slate-700 dark:text-slate-400 font-mono">{primaryNode}</strong></span>
            <span className="mx-2">•</span>
            <span>API 连接正常</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ActionConfirmModal
        isOpen={actionModal.isOpen}
        guest={actionModal.guest}
        action={actionModal.action}
        isLoading={isActionExecuting}
        onConfirm={handleConfirmAction}
        onCancel={() => setActionModal({ isOpen: false, guest: null, action: null, isDestructive: false })}
      />

      <GuestDetailModal
        isOpen={!!detailGuest}
        guest={detailGuest}
        onClose={() => setDetailGuest(null)}
        onActionClick={(g, a) => {
          setDetailGuest(null);
          handleOpenActionModal(g, a);
        }}
      />

      <NodeDetailsModal
        isOpen={isNodeDetailsOpen}
        onClose={() => setIsNodeDetailsOpen(false)}
        nodeStatus={nodeStatus}
        storages={storages}
        version={version}
        thermal={thermal}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigSaved={() => loadData(false)}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
