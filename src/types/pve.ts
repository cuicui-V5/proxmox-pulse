export interface CpuThermalInfo {
  available: boolean;
  main: number | null;
  unit: string;
  source?: string;
  cores: Array<{
    label: string;
    temp: number;
    max?: number;
    crit?: number;
  }>;
  message?: string;
}

export interface PveVersion {
  version: string;
  release: string;
  repoid: string;
}

export interface NodeStatus {
  node: string;
  uptime: number;
  cpu: number;
  wait: number;
  idle: number;
  kversion: string;
  cpuinfo: {
    model: string;
    cores: number;
    sockets: number;
    mhz: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    available?: number;
  };
  swap: {
    total: number;
    used: number;
    free: number;
  };
  rootfs: {
    total: number;
    used: number;
    free: number;
    avail: number;
  };
  loadavg: [string, string, string];
  pveversion: string;
}

export interface ClusterResource {
  id: string;
  type: 'qemu' | 'lxc' | 'node' | 'storage' | 'network' | 'pool';
  node: string;
  status: string;
  name?: string;
  vmid?: number;
  maxcpu?: number;
  cpu?: number;
  maxmem?: number;
  mem?: number;
  memhost?: number;
  maxdisk?: number;
  disk?: number;
  diskread?: number;
  diskwrite?: number;
  netin?: number;
  netout?: number;
  uptime?: number;
  template?: number;
  storage?: string;
  plugintype?: string;
  shared?: number;
  content?: string;
  ips?: string[];
}

export interface StorageInfo {
  storage: string;
  type: string;
  content: string;
  total?: number;
  used?: number;
  avail?: number;
  used_fraction?: number;
  active?: number;
  enabled?: number;
  shared?: number;
}

export interface GuestDetail {
  node: string;
  type: 'qemu' | 'lxc';
  vmid: number;
  status: {
    status: string;
    qmpstatus?: string;
    cpu?: number;
    cpus?: number;
    mem?: number;
    maxmem?: number;
    disk?: number;
    maxdisk?: number;
    uptime?: number;
    netin?: number;
    netout?: number;
    diskread?: number;
    diskwrite?: number;
    balloon?: number;
    agent?: number;
  };
  config: Record<string, any>;
  agentInterfaces: Array<{
    name: string;
    'hardware-address'?: string;
    'ip-addresses'?: Array<{
      'ip-address': string;
      'ip-address-type': string;
      prefix?: number;
    }>;
  }>;
}

export interface RrdDataPoint {
  time: number;
  cpu?: number;
  iowait?: number;
  loadavg?: number;
  mem?: number;
  maxmem?: number;
  memused?: number;
  memtotal?: number;
  netin?: number;
  netout?: number;
  diskread?: number;
  diskwrite?: number;
  disk?: number;
  maxdisk?: number;
  rootused?: number;
  roottotal?: number;
  swapused?: number;
  swaptotal?: number;
}

export type GuestAction = 'start' | 'shutdown' | 'stop' | 'reboot' | 'reset' | 'suspend' | 'resume';

export interface ActionModalState {
  isOpen: boolean;
  guest: ClusterResource | null;
  action: GuestAction | null;
  isDestructive: boolean;
}
