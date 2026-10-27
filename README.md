# Proxmox Pulse

<div align="center">

![Proxmox Pulse](https://img.shields.io/badge/Proxmox_VE-9.x_%7C_8.x-E57000?style=for-the-badge&logo=proxmox&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

<p align="center">
  <b>现代 • 简约 • 极速 • 全功能的 Proxmox VE 监控管理面板</b>
  <br />
  实时状态感知 / CPU 核心温度监控 / RRD 原生历史性能曲线 / QEMU Guest Agent IP 自动发现 / 安全虚拟机电源控制
</p>

[English](#features) | [简体中文](#功能特性)

</div>

---

## 🌟 功能特性 (Features)

- 🎨 **现代简约双主题**：默认清爽浅色模式，支持一键切换高级暗黑模式，兼顾桌面宽屏与移动端响应式体验。
- 🌡️ **宿主机 CPU 核心温度监控**：支持 Intel Core/Package、AMD Ryzen/EPYC 及 ACPI 传感器，直观展示整机与各核心温度分布。
- 📈 **PVE 原生 RRD 历史性能趋势**：无缝对接 PVE 内部高精度 RRD 引擎，提供 **1小时 / 24小时 / 7天 / 30天 / 1年** 粒度曲线：
  - CPU 使用率与 IO 等待 (iowait)
  - 内存已用与配额变化 (RAM Used vs Quota)
  - 网络实时吞吐速率 (流入 Rx / 流出 Tx)
  - 磁盘 I/O 吞吐速率 (Read / Write)
- 🌐 **QEMU Guest Agent 自动感知**：无需手动记录 IP，自动发现虚拟机真实内网 IP 地址，支持一键点击复制。
- ⚡ **安全全功能电源管理**：
  - ACPI 优雅关机 (Shutdown)
  - 软重启 (Reboot)
  - 强制断电 (Stop) 与 强制复位 (Reset)（带双重防误触二次确认保护）
  - 开机启动 (Start)
  - UPID 异步任务进度自动跟踪与轻量 Toast 通知。
- 🗄️ **存储池容量洞察**：直观展示 `local`、`local-lvm`、ZFS、NFS 等各存储池的使用率与配额。
- 🔍 **多维快速检索与过滤**：支持按虚拟机名称、VMID、内网 IP 实时模糊过滤，支持卡片网格与紧凑表格双视图自由切换。
- 🌍 **通用化设计，即开即用**：零硬编码，适用于任意标准 Proxmox VE 节点，发给朋友即可直接部署使用！

---

## 🚀 30秒极速部署 (给朋友的开箱指南)

不管是部署在局域网的软路由、NAS、Ubuntu 虚拟机，还是你的个人 PC 上，都能一键启动。

### 方式一：Docker Compose 部署（最推荐）

1. **克隆仓库**：
   ```bash
   git clone https://github.com/cuicui-V5/proxmox-pulse.git
   cd proxmox-pulse
   ```

2. **配置环境变量**：
   ```bash
   cp .env.example .env
   ```
   打开 `.env` 填入你的 PVE 主机 IP 与 API Token（详见下方 Token 生成说明）：
   ```ini
   PVE_HOST=192.168.2.5
   PVE_PORT=8006
   PVE_TOKEN_ID=root@pam!dashboard
   PVE_TOKEN_SECRET=你的-token-secret-uuid
   PVE_VERIFY_SSL=false
   ```

3. **启动容器**：
   ```bash
   docker compose up -d --build
   ```

4. **访问面板**：
   在浏览器中打开 `http://<机器IP>:3333` 即可畅享面板！

---

### 方式二：网页图形化连接向导（零配置直接跑）

如果不愿提前修改配置文件，可以直接启动空白容器：
```bash
docker run -d --name proxmox-pulse --restart unless-stopped -p 3333:3333 pve-pulse-dashboard:latest
```
直接在浏览器打开 `http://<IP>:3333`，面板将自动弹出**配置连接向导**，在界面上直接填入 PVE 地址与 Token，点击保存即可连接！

---

## 🔑 如何在 PVE 上生成 API Token？（30 秒完成）

使用 API Token 是 Proxmox VE 官方推荐的最安全免密通信方式：

1. 登录 PVE Web 管理界面的 `Shell`，或者通过 SSH 登录 PVE 宿主机。
2. 粘贴执行以下单行命令：
   ```bash
   pveum user token add root@pam dashboard --privsep 0
   ```
3. 终端会输出类似以下内容：
   ```json
   {
     "full-tokenid": "root@pam!dashboard",
     "info": { "privsep": "0" },
     "value": "84f861de-7435-4985-9ff4-af03419b8781"
   }
   ```
4. 将 `root@pam!dashboard` 填为 **Token ID**，将 `value` 后的 UUID 串填为 **Token Secret** 即可！

---

## 🌡️ 关于 CPU 温度监控的说明（PVE 原生 REST API 免密直连）

Proxmox VE 官方 API 默认未返回硬件温度，常规做法通常需要开放 SSH 端口并传递主机 root 密码，既不安全也破坏了 API Token 的纯净架构。

Proxmox Pulse 采用 **100% 纯 API Token 直连方案**，面板完全不需要任何 SSH 密码或开放 22 端口！

### 🚀 一键开启温度接口（3 秒完成）
在 PVE 宿主机网页端的 `Shell` 中粘贴并执行以下单行命令：
```bash
curl -sSL https://raw.githubusercontent.com/cuicui-V5/proxmox-pulse/main/setup-pve-thermal.sh | bash
```

### 💡 技术原理与安全性说明
- **工作原理**：向 PVE 官方节点状态接口 (`/usr/share/perl5/PVE/API2/Nodes.pm`) 追加轻量只读读取逻辑 (`sensors -j`)，使 PVE 官方 REST API (`GET /api2/json/nodes/{node}/status`) 直接返回 `thermalstate` 结构化 JSON。
- **纯净安全**：
  - 🔒 **零 SSH 依赖**：面板与 PVE 的所有通信（状态、指标、电源、温度）100% 运行在官方 HTTPS 8006 端口上，仅使用受限 API Token。
  - ⚡ **零额外网络延迟**：温度随节点常规状态一并返回，无需反复建立 SSH 握手连接。
  - 🛡️ **不影响系统更新**：脚本在注入前会自动备份原文件；Debian/PVE 后续系统升级 (`apt update && apt dist-upgrade`) 会直接平滑覆盖该非配置模板文件，绝不报错或中断软件包升级。
  - 🔄 **随时一键无痕还原**：如需恢复 PVE 初始状态，随时执行 `curl -sSL https://raw.githubusercontent.com/cuicui-V5/proxmox-pulse/main/setup-pve-thermal.sh | bash -s -- uninstall` 即可秒级还原官方出厂文件。

---

## 🛠️ 本地开发与构建

```bash
# 1. 安装依赖
npm install

# 2. 启动开发模式 (同时运行后端网关与 Vite 热更新)
npm run dev

# 3. 生产打包
npm run build

# 4. 生产环境启动
npm start
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。欢迎 Star、Fork 与提 Issue！
