import React from 'react';
import { Server, Monitor, HardDrive, Terminal } from 'lucide-react';

export function getOsInfo(name?: string, ostype?: string): {
  label: string;
  badgeColor: string;
  icon: React.ReactNode;
} {
  const lowerName = (name || '').toLowerCase();
  const lowerOs = (ostype || '').toLowerCase();

  if (lowerName.includes('win') || lowerOs.includes('win')) {
    return {
      label: 'Windows',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      icon: (
        <svg className="w-4 h-4 fill-current text-blue-400" viewBox="0 0 24 24">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.802" />
        </svg>
      )
    };
  }

  if (lowerName.includes('ubuntu') || lowerOs.includes('ubuntu')) {
    return {
      label: 'Ubuntu',
      badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      icon: (
        <svg className="w-4 h-4 fill-current text-orange-400" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="4" r="2" />
          <circle cx="5" cy="16" r="2" />
          <circle cx="19" cy="16" r="2" />
        </svg>
      )
    };
  }

  if (lowerName.includes('owrt') || lowerName.includes('openwrt')) {
    return {
      label: 'OpenWrt',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      icon: (
        <svg className="w-4 h-4 fill-current text-cyan-400" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      )
    };
  }

  if (lowerName.includes('debian') || lowerOs.includes('debian')) {
    return {
      label: 'Debian',
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      icon: <Terminal className="w-4 h-4 text-rose-400" />
    };
  }

  if (lowerName.includes('alpine')) {
    return {
      label: 'Alpine',
      badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      icon: <Server className="w-4 h-4 text-teal-400" />
    };
  }

  if (lowerOs.startsWith('l') || lowerName.includes('linux')) {
    return {
      label: 'Linux',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: <Terminal className="w-4 h-4 text-emerald-400" />
    };
  }

  return {
    label: 'VM',
    badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    icon: <Monitor className="w-4 h-4 text-slate-400" />
  };
}
