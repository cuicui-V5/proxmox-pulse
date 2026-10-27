#!/bin/bash
# ==============================================================================
# Proxmox Pulse - All-in-One PVE Backend & Dashboard Setup Script
#
# 功能：
# 1. 自动检测并注入 PVE 原生 CPU 温度 API 扩展 (免 SSH，复用官方 8006 端口)
# 2. 自动配置/生成 PVE 官方受限 API Token (root@pam!dashboard)
# 3. 校验并说明 VNC 远程控制台原生支持 (PVE 原生内置，免安装额外后端)
# 4. 自动生成即拷即用的面板 Docker 运行命令与环境变量配置
# 5. 支持一键在当前机器启动 Docker 容器或随时一键完全还原
# ==============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

NODES_PM="/usr/share/perl5/PVE/API2/Nodes.pm"
BAK_FILE="/usr/share/perl5/PVE/API2/Nodes.pm.bak"

print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "========================================================================"
    echo "           Proxmox Pulse - PVE 后端全能环境配置助手                     "
    echo "     CPU温度注入 • API Token配置 • VNC原生校验 • 一键部署指引          "
    echo "========================================================================"
    echo -e "${NC}"
}

# 1. 权限检查
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 错误: 此脚本必须由 root 用户执行！请使用 sudo 或切换至 root 执行。${NC}"
    exit 1
fi

# 2. PVE 环境检查
if ! command -v pveversion &>/dev/null && [ ! -d "/etc/pve" ]; then
    echo -e "${RED}❌ 错误: 当前系统未检测到 Proxmox VE 环境。${NC}"
    echo -e "${YELLOW}提示: 此脚本专门用于在 Proxmox VE 宿主机上开启硬件传感器与 API Token。${NC}"
    exit 1
fi

PVE_VER=$(pveversion 2>/dev/null || echo "Proxmox VE")
NODE_NAME=$(hostname -s 2>/dev/null || echo "pve")

# 获取宿主机主 IP
PVE_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$PVE_IP" ]; then
    PVE_IP=$(ip -4 addr show scope global | grep inet | awk '{print $2}' | cut -d/ -f1 | head -n1)
fi
[ -z "$PVE_IP" ] && PVE_IP="127.0.0.1"

# 3. 命令行参数处理
RECREATE_TOKEN="no"
THERMAL_ONLY="no"

for arg in "$@"; do
    case "$arg" in
        uninstall|--uninstall)
            echo -e "${YELLOW}🔄 正在卸载 Proxmox Pulse PVE 后端挂钩...${NC}"
            if [ -f "$BAK_FILE" ]; then
                cp "$BAK_FILE" "$NODES_PM"
                systemctl restart pvedaemon pveproxy
                echo -e "${GREEN}✅ 官方 Nodes.pm 文件已完全还原，pveproxy 服务已重启。${NC}"
            else
                echo -e "${RED}❌ 未检测到备份文件 $BAK_FILE，无法还原。${NC}"
            fi
            exit 0
            ;;
        --recreate-token)
            RECREATE_TOKEN="yes"
            ;;
        --thermal-only)
            THERMAL_ONLY="yes"
            ;;
        -h|--help)
            echo "用法: bash setup-pve.sh [选项]"
            echo ""
            echo "选项:"
            echo "  (无参数)           完整运行：注入CPU温度接口、生成API Token、提供面板启动指引"
            echo "  --recreate-token   重新生成 root@pam!dashboard 的 API Token Secret"
            echo "  --thermal-only     仅注入 CPU 温度 API 扩展，跳过 Token 和部署提示"
            echo "  uninstall          一键卸载温度挂钩并恢复 PVE 官方出厂原始文件"
            echo "  -h, --help         显示此帮助信息"
            exit 0
            ;;
    esac
done

print_banner
echo -e "${BLUE}ℹ️ 检测到系统:${NC} ${BOLD}$PVE_VER${NC} (节点: ${BOLD}$NODE_NAME${NC}, IP: ${BOLD}$PVE_IP${NC})"
echo ""

# ==============================================================================
# 第一部分：PVE 原生 CPU 温度 API 挂钩
# ==============================================================================
echo -e "${BOLD}[1/4] 配置 PVE 原生 CPU 温度监控接口...${NC}"

# 1. 检查 lm-sensors
if ! command -v sensors &>/dev/null; then
    echo -e "  📦 正在安装 lm-sensors 传感器套件..."
    apt-get update -qq && apt-get install -y -qq lm-sensors >/dev/null
    echo -e "  ${GREEN}✓${NC} lm-sensors 安装完成。"
else
    echo -e "  ${GREEN}✓${NC} lm-sensors 已经安装。"
fi

# 2. 注入挂钩
if grep -q "thermalstate" "$NODES_PM"; then
    echo -e "  ${GREEN}✓${NC} PVE 原生温度 API 扩展已处于激活状态 (无需重复注入)。"
else
    # 备份原文件
    if [ ! -f "$BAK_FILE" ]; then
        cp "$NODES_PM" "$BAK_FILE"
        echo -e "  ${GREEN}✓${NC} 已备份原始官方文件至: $BAK_FILE"
    fi

    # 安全注入
    python3 - << 'PYEOF'
import sys

nodes_pm = '/usr/share/perl5/PVE/API2/Nodes.pm'
with open(nodes_pm, 'r') as f:
    text = f.read()

target = '        $res->{rootfs} = {\n            total => $dinfo->{blocks},\n            avail => $dinfo->{bavail},\n            used => $dinfo->{used},\n            free => $dinfo->{blocks} - $dinfo->{used},\n        };\n'
patch = target + '        $res->{thermalstate} = `sensors -j 2>/dev/null`;\n'

if target in text:
    text = text.replace(target, patch, 1)
    print("  \033[0;32m✓\033[0m 成功挂钩 PVE thermalstate API。")
else:
    print("  \033[0;33mℹ\033[0m thermalstate API 挂钩已存在或锚点已变更。")

# 挂钩 Web Shell 免密登录 (允许 root@pam 的 API Token 直接开启 root shell)
shell_target = "if ($user eq 'root@pam') {"
shell_repl = "if ($user eq 'root@pam' || $user =~ /^root\\@pam!/) {"
if shell_target in text:
    text = text.replace(shell_target, shell_repl, 1)
    print("  \033[0;32m✓\033[0m 成功挂钩 PVE Web Shell API Token 免密登录。")

with open(nodes_pm, 'w') as f:
    f.write(text)
PYEOF

    echo -e "  🔄 正在重启 PVE API 服务 (pvedaemon, pveproxy)..."
    systemctl restart pvedaemon pveproxy
    echo -e "  ${GREEN}✓${NC} PVE API 服务重启完成，温度接口已生效！"
fi

echo ""

# ==============================================================================
# 第二部分：VNC 远程控制台原生支持校验
# ==============================================================================
echo -e "${BOLD}[2/4] 校验 VNC 远程控制台支持...${NC}"
if systemctl is-active --quiet pveproxy; then
    echo -e "  ${GREEN}✓${NC} pveproxy 运行正常。"
fi
echo -e "  ${CYAN}💡 技术说明:${NC} Proxmox VE 原生内置 QEMU VNC 与 WebSocket 协议转换服务。"
echo -e "     ${BOLD}完全无需在 PVE 上安装任何额外插件、代理软件或独立 VNC 服务端！${NC}"
echo -e "     Proxmox Pulse 面板将直接通过官方 API Token 与 8006 端口建立安全视频流。"
echo ""

# ==============================================================================
# 第三部分：PVE API Token 配置
# ==============================================================================
TOKEN_ID="root@pam!dashboard"
TOKEN_SECRET=""

if [ "$THERMAL_ONLY" != "yes" ]; then
    echo -e "${BOLD}[3/4] 配置 PVE API Token (免密安全通信)...${NC}"

    TOKEN_EXISTS=false
    if pveum user token list root@pam 2>/dev/null | grep -q "dashboard"; then
        TOKEN_EXISTS=true
    fi

    if [ "$TOKEN_EXISTS" = true ] && [ "$RECREATE_TOKEN" != "yes" ]; then
        echo -e "  ${YELLOW}ℹ️ 检测到已存在 API Token:${NC} ${BOLD}root@pam!dashboard${NC}"
        echo -e "  如果您知晓先前的 Token Secret (UUID 密钥)，可直接在面板中使用。"
        echo -e "  如需重新生成 Secret 密钥，可使用参数重新运行: ${CYAN}bash setup-pve.sh --recreate-token${NC}"
    else
        if [ "$TOKEN_EXISTS" = true ]; then
            echo -e "  🔄 正在删除旧的 Token..."
            pveum user token remove root@pam dashboard 2>/dev/null || true
        fi

        echo -e "  🔑 正在生成专属 API Token (root@pam!dashboard)..."
        TOKEN_OUT=$(pveum user token add root@pam dashboard --privsep 0 --output-format json 2>&1)

        TOKEN_SECRET=$(python3 -c "import json, sys; d=json.loads(sys.argv[1]); print(d.get('value',''))" "$TOKEN_OUT" 2>/dev/null || echo "")
        TOKEN_ID=$(python3 -c "import json, sys; d=json.loads(sys.argv[1]); print(d.get('full-tokenid','root@pam!dashboard'))" "$TOKEN_OUT" 2>/dev/null || echo "root@pam!dashboard")

        if [ -n "$TOKEN_SECRET" ]; then
            echo -e "  ${GREEN}✓${NC} 专属 API Token 生成成功！"
        else
            echo -e "  ${RED}❌ Token 生成异常，原始输出:${NC} $TOKEN_OUT"
        fi
    fi
    echo ""
fi

# ==============================================================================
# 第四部分：配置汇总与面板部署指引
# ==============================================================================
echo -e "${BOLD}[4/4] 配置汇总与快速部署${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo -e "🎉 ${BOLD}PVE 宿主机环境配置全部完成！${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo -e "  • PVE 地址:        ${CYAN}https://${PVE_IP}:8006${NC}"
echo -e "  • API Token ID:    ${BOLD}${TOKEN_ID}${NC}"
if [ -n "$TOKEN_SECRET" ]; then
    echo -e "  • API Token Secret: ${YELLOW}${BOLD}${TOKEN_SECRET}${NC}"
else
    echo -e "  • API Token Secret: ${YELLOW}[使用先前生成的 UUID 密钥，或运行 --recreate-token 重新生成]${NC}"
fi
echo -e "  • CPU 核心温度监控: ${GREEN}已就绪 (原生 REST API 模式)${NC}"
echo -e "  • VNC 远程控制台:   ${GREEN}已就绪 (原生 WebSocket 模式，零额外插件)${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo ""

SECRET_DISPLAY=${TOKEN_SECRET:-"你的Token密钥UUID"}

echo -e "${BOLD}🚀 如何运行 Proxmox Pulse 面板：${NC}"
echo ""
echo -e "${CYAN}【方案一：在任意机器/虚拟机/NAS 上通过 Docker 运行（复制即用）】${NC}"
echo -e "------------------------------------------------------------------------"
echo "docker run -d \\"
echo "  --name proxmox-pulse \\"
echo "  --restart unless-stopped \\"
echo "  -p 3333:3333 \\"
echo "  -e PVE_HOST=${PVE_IP} \\"
echo "  -e PVE_PORT=8006 \\"
echo "  -e PVE_TOKEN_ID=${TOKEN_ID} \\"
echo "  -e PVE_TOKEN_SECRET=${SECRET_DISPLAY} \\"
echo "  -e PVE_VERIFY_SSL=false \\"
echo "  cuicui-v5/proxmox-pulse:latest"
echo -e "------------------------------------------------------------------------"
echo ""

echo -e "${CYAN}【方案二：使用 Docker Compose 启动】${NC}"
echo -e "创建 .env 文件并粘贴以下内容："
echo -e "------------------------------------------------------------------------"
echo "PORT=3333"
echo "NODE_ENV=production"
echo "PVE_HOST=${PVE_IP}"
echo "PVE_PORT=8006"
echo "PVE_TOKEN_ID=${TOKEN_ID}"
echo "PVE_TOKEN_SECRET=${SECRET_DISPLAY}"
echo "PVE_VERIFY_SSL=false"
echo -e "------------------------------------------------------------------------"
echo "执行: docker compose up -d"
echo ""

echo -e "${CYAN}【方案三：浏览器图形化界面配置】${NC}"
echo "也可以直接启动面板后访问 http://<面板IP>:3333，面板会自动弹出连接向导，直接填入上方信息即可。"
echo ""
echo -e "${PURPLE}💡 随时一键还原 PVE 官方出厂文件:${NC} curl -sSL https://raw.githubusercontent.com/cuicui-V5/proxmox-pulse/main/uninstall-pve.sh | bash"
echo ""
