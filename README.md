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
  实时状态感知 / 原生 HTML5 VNC 远程控制台 / CPU 核心温度监控 / RRD 历史性能曲线 / QEMU Guest Agent IP 自动发现 / 虚拟机电源控制
</p>

</div>

---

## 🌟 功能特性 (Features)

- 🎨 **现代简约双主题**：默认清爽浅色模式，支持一键切换高级暗黑模式，兼顾桌面宽屏与移动端响应式体验。
- 🖥️ **原生 HTML5 VNC 远程控制台 (noVNC)**：
  - 零客户端、零插件，直接在浏览器中秒级唤起虚拟机或容器控制台。
  - 支持 **自适应缩放 (Scale to Fit) / 1:1 原始分辨率** 及 **一键全屏沉浸操作**。
  - 贴心运维工具栏：一键发送 `Ctrl + Alt + Del`、Windows 键、Escape、Tab 等系统特殊键，支持远程剪贴板文本写入。
  - 架构极致安全：通过面板后端 WebSocket 隧道智能中继，**无需在宿主机额外开放 VNC 端口**，也无需直接暴露 PVE 8006 端口。
- 🌡️ **宿主机 CPU 核心温度监控 (PVE 原生 REST API)**：
  - 100% 纯 API Token 免密通信，支持 Intel Core/Package、AMD Ryzen/EPYC 及 ACPI 传感器，直观展示整机与各核心温度分布。
  - 零 SSH 依赖，零网络开销，不影响 Debian/PVE 后续系统升级。
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

## ❓ 常见疑问：VNC 远程控制台需要在 PVE 上安装后端吗？

**答：完全不需要！**

- **为什么？**
  Proxmox VE 底层基于 QEMU/KVM 虚拟化，QEMU 在创建虚拟机时**天然在底层开启了 VNC 显示服务**；同时 PVE 官方出厂即内置了 `pveproxy`，提供将 VNC 画面转为 WebSocket 视频流的官方标准端点。
- **Proxmox Pulse 如何实现？**
  面板后端仅通过官方标准的 API Token 发起请求，并在本地启动轻量 WebSocket 隧道与 PVE 原生端点对接，浏览器前端通过 Canvas 硬件加速渲染画面。
- **结论**：
  PVE 宿主机 **零依赖、零插件、零额外守护进程**，开箱即用！

---

## 🚀 极速部署指南 (两步完成)

无论面板是部署在你的个人 PC、NAS、软路由、Ubuntu 虚拟机，还是直接部署在 PVE 宿主机上，仅需以下两步：

### 第一步：PVE 宿主机一键全能初始化 (合二为一脚本)

登录 PVE 网页管理界面的 `Shell`（或通过 SSH 登录 PVE 宿主机），粘贴执行以下单行命令：

```bash
curl -sSL https://raw.githubusercontent.com/cuicui-V5/proxmox-pulse/main/setup-pve.sh | bash
```

> **该全能脚本将全自动为您完成：**
> 1. 安装 `lm-sensors` 硬件探测包；
> 2. 向 PVE 原生 API 注入只读 CPU 温度读取挂钩（自动备份原文件，重启 API 立即生效）；
> 3. 校验并确认 VNC 远程控制台原生就绪；
> 4. 自动生成专属受限 API Token（`root@pam!dashboard`）；
> 5. 终端直接打印出**属于您这台 PVE 机器的现成 Docker 启动命令与 Token 密钥**！

---

### 第二步：启动 Proxmox Pulse 面板

在你想运行面板的机器上（可以是你的个人电脑、局域网服务器、NAS 或 PVE 虚拟机），选择以下任意一种方式启动：

#### 方式一：Docker 一键命令秒启（最推荐）

将第一步脚本输出的命令直接复制执行，或运行下方命令（替换你的 IP 与 Token Secret）：

```bash
docker run -d \
  --name proxmox-pulse \
  --restart unless-stopped \
  -p 3333:3333 \
  -e PVE_HOST=192.168.2.5 \
  -e PVE_PORT=8006 \
  -e PVE_TOKEN_ID=root@pam!dashboard \
  -e PVE_TOKEN_SECRET=你的TokenSecretUUID \
  -e PVE_VERIFY_SSL=false \
  cuicui-v5/proxmox-pulse:latest
```

启动完成后，在浏览器中打开 `http://<机器IP>:3333` 即可立即使用！

---

#### 方式二：Docker Compose 部署（配置持久化）

1. **克隆仓库**：
   ```bash
   git clone https://github.com/cuicui-V5/proxmox-pulse.git
   cd proxmox-pulse
   ```

2. **配置环境变量**：
   ```bash
   cp .env.example .env
   ```
   修改 `.env` 文件，填入你的 PVE 地址与 Token：
   ```ini
   PORT=3333
   NODE_ENV=production
   PVE_HOST=192.168.2.5
   PVE_PORT=8006
   PVE_TOKEN_ID=root@pam!dashboard
   PVE_TOKEN_SECRET=你的TokenSecretUUID
   PVE_VERIFY_SSL=false
   ```

3. **启动容器**：
   ```bash
   docker compose up -d --build
   ```

---

#### 方式三：网页图形化连接向导（零配置直接跑）

如果不愿提前修改配置文件，可以直接启动空白容器：
```bash
docker run -d --name proxmox-pulse --restart unless-stopped -p 3333:3333 cuicui-v5/proxmox-pulse:latest
```
直接在浏览器访问 `http://<IP>:3333`，面板将自动弹出**配置连接向导**，在界面上填入 PVE 地址与 Token 密钥，点击「保存」即可直连。

---

#### 方式四：Node.js 本地开发与源码运行

```bash
# 1. 安装依赖
npm install

# 2. 编译生产前端
npm run build

# 3. 生产环境启动
npm start

# 开发调试模式 (前后端热更新)
npm run dev
```

---

## ⚙️ 环境变量配置对照表 (Environment Variables)

| 环境变量 | 必填 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `PORT` | 否 | `3333` | 面板 Web 监听端口 |
| `NODE_ENV` | 否 | `production` | 运行环境模式 (`production` / `development`) |
| `PVE_HOST` | **是** | `192.168.2.5` | PVE 宿主机 IP 地址或域名 |
| `PVE_PORT` | 否 | `8006` | PVE 官方 Web API 端口 |
| `PVE_TOKEN_ID` | **是** | `root@pam!dashboard` | PVE API Token 标识符 |
| `PVE_TOKEN_SECRET` | **是** | - | PVE API Token UUID 密钥 |
| `PVE_VERIFY_SSL` | 否 | `false` | 是否强校验 SSL 证书（PVE 默认自签名证书请设为 `false`） |

---

## 🌐 反向代理与公网穿透说明 (Nginx / Caddy / 1Panel)

> [!IMPORTANT]
> **您只需要反向代理面板自身的 `3333` 端口！**
> 完全不需要将 PVE 的 `8006` 端口或任何 VNC 端口暴露到公网，面板后端会自动将 VNC 流量与 API 请求封装为内部长连接。

### Nginx 反代配置示例 (需开启 WebSocket 支持)

```nginx
server {
    listen 80;
    server_name pve.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;

        # 核心：支持 noVNC WebSocket 隧道长连接
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 控制台长连接保活
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 🛠️ PVE 宿主机维护与还原

如需恢复 PVE 官方出厂初始状态，随时在 PVE 宿主机 Shell 中执行单行命令：

```bash
curl -sSL https://raw.githubusercontent.com/cuicui-V5/proxmox-pulse/main/setup-pve.sh | bash -s -- uninstall
```
脚本将秒级恢复官方出厂文件并重启服务，零任何文件残留。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。欢迎 Star、Fork 与提 Issue！
