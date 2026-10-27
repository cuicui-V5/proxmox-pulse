import { NodeStatus, ClusterResource, GuestDetail, RrdDataPoint, StorageInfo, GuestAction, CpuThermalInfo } from '../types/pve';

const BASE_URL = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function fetchOverview(): Promise<{
  ok: boolean;
  version: any;
  primaryNode: string;
  nodeStatus: NodeStatus;
  nodes: any[];
  storages: StorageInfo[];
  thermal?: CpuThermalInfo;
  summary: {
    totalGuests: number;
    runningGuests: number;
    stoppedGuests: number;
    pausedGuests: number;
    qemuCount: number;
    lxcCount: number;
  };
}> {
  const res = await fetch(`${BASE_URL}/overview`);
  if (!res.ok) throw new Error('Failed to fetch overview data');
  return res.json();
}

export async function fetchGuests(): Promise<ClusterResource[]> {
  const res = await fetch(`${BASE_URL}/guests`);
  if (!res.ok) throw new Error('Failed to fetch guests');
  const data = await res.json();
  return data.guests || [];
}

export async function fetchGuestDetail(node: string, type: string, vmid: number): Promise<GuestDetail> {
  const res = await fetch(`${BASE_URL}/guests/${node}/${type}/${vmid}`);
  if (!res.ok) throw new Error('Failed to fetch guest details');
  const data = await res.json();
  return data.guest;
}

export async function fetchNodeRrd(node: string, timeframe: string): Promise<RrdDataPoint[]> {
  const res = await fetch(`${BASE_URL}/nodes/${node}/rrddata?timeframe=${timeframe}`);
  if (!res.ok) throw new Error('Failed to fetch node historical metrics');
  const data = await res.json();
  return data.data || [];
}

export async function fetchGuestRrd(node: string, type: string, vmid: number, timeframe: string): Promise<RrdDataPoint[]> {
  const res = await fetch(`${BASE_URL}/guests/${node}/${type}/${vmid}/rrddata?timeframe=${timeframe}`);
  if (!res.ok) throw new Error('Failed to fetch guest historical metrics');
  const data = await res.json();
  return data.data || [];
}

export async function executeGuestAction(
  node: string,
  type: string,
  vmid: number,
  action: GuestAction
): Promise<{ ok: boolean; upid?: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/guests/${node}/${type}/${vmid}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  return res.json();
}

export async function pollTaskStatus(node: string, upid: string) {
  const res = await fetch(`${BASE_URL}/tasks/${node}/${encodeURIComponent(upid)}`);
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${BASE_URL}/config`);
  return res.json();
}

export async function saveConfig(config: any) {
  const res = await fetch(`${BASE_URL}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return res.json();
}
