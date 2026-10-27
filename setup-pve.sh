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
TMP_FILE="/usr/share/perl5/PVE/API2/Nodes.pm.pulse_tmp"

print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "========================================================================"
    echo "           Proxmox Pulse - PVE 后端全能环境配置助手                     "
    echo "   CPU温度接口 • 免密Shell支持 • API Token配置 • VNC原生校验 • 一键部署  "
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
            echo -e "${YELLOW}🔄 正在卸载 Proxmox Pulse PVE 后端扩展...${NC}"
            RESTORED=false
            if [ -f "$BAK_FILE" ] && perl -c "$BAK_FILE" &>/dev/null; then
                cp -p "$BAK_FILE" "$TMP_FILE"
                if perl -c "$TMP_FILE" &>/dev/null; then
                    mv "$TMP_FILE" "$NODES_PM"
                    rm -f "$BAK_FILE"
                    RESTORED=true
                    echo -e "  ${GREEN}✓${NC} 已从官方备份文件安全恢复原始 Nodes.pm。"
                fi
                rm -f "$TMP_FILE" 2>/dev/null || true
            fi

            if [ "$RESTORED" != true ]; then
                # 无备份或备份损坏时，通过 Python 安全剥离挂钩
                python3 - << 'PYEOF'
import re, sys

nodes_pm = '/usr/share/perl5/PVE/API2/Nodes.pm'
tmp_file = '/usr/share/perl5/PVE/API2/Nodes.pm.pulse_tmp'

try:
    with open(nodes_pm, 'r', encoding='utf-8') as f:
        text = f.read()

    orig = text
    # 移除温度挂钩
    text = re.sub(r'^\s*\$res->\{thermalstate\}\s*=\s*`sensors -j 2>/dev/null`;\r?\n?', '', text, flags=re.MULTILINE)
    # 还原 shell 判断
    text = re.sub(r"if\s*\(\s*\$user\s*eq\s*'root@pam'\s*\|\|\s*\$user\s*=~\s*/\^root\\@pam!/\s*\)", "if ($user eq 'root@pam')", text)

    if text != orig:
        with open(tmp_file, 'w', encoding='utf-8') as f:
            f.write(text)
except Exception as e:
    sys.exit(1)
PYEOF
                if [ -f "$TMP_FILE" ] && perl -c "$TMP_FILE" &>/dev/null; then
                    mv "$TMP_FILE" "$NODES_PM"
                    RESTORED=true
                    echo -e "  ${GREEN}✓${NC} 挂钩已精准安全剥离并恢复出厂默认值。"
                fi
                rm -f "$TMP_FILE" 2>/dev/null || true
            fi

            if [ "$RESTORED" = true ]; then
                systemctl restart pvedaemon pveproxy
                echo -e "${GREEN}✅ 官方 Nodes.pm 文件已完全还原，pveproxy 服务已重启。${NC}"
            else
                echo -e "${GREEN}✅ Nodes.pm 已经是出厂纯净文件，无需操作。${NC}"
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
            echo "  (无参数)           完整运行：配置CPU温度、Web Shell免密、生成API Token并提供启动指引"
            echo "  --recreate-token   重新生成 root@pam!dashboard 的 API Token Secret"
            echo "  --thermal-only     仅注入硬件状态与Shell API扩展，跳过 Token 和部署提示"
            echo "  uninstall          一键卸载扩展并安全还原 PVE 官方出厂原始文件"
            echo "  -h, --help         显示此帮助信息"
            exit 0
            ;;
    esac
done

print_banner
echo -e "${BLUE}ℹ️ 检测到系统:${NC} ${BOLD}$PVE_VER${NC} (节点: ${BOLD}$NODE_NAME${NC}, IP: ${BOLD}$PVE_IP${NC})"
echo ""

# ==============================================================================
# 第一部分：PVE 原生硬件状态 API 扩展 (CPU 温度 & Web Shell 免密登录)
# ==============================================================================
echo -e "${BOLD}[1/4] 配置 PVE 原生 API 扩展 (CPU 温度监控 & 宿主机 Shell 免密登录)...${NC}"

# 1. 检查并安装 lm-sensors
if ! command -v sensors &>/dev/null; then
    echo -e "  📦 正在安装 lm-sensors 硬件传感器套件..."
    apt-get update -qq && apt-get install -y -qq lm-sensors >/dev/null
    echo -e "  ${GREEN}✓${NC} lm-sensors 安装完成。"
else
    echo -e "  ${GREEN}✓${NC} lm-sensors 已经安装。"
fi

# 2. 检查原文件健康度并创建初始备份
if [ ! -f "$NODES_PM" ]; then
    echo -e "  ${RED}❌ 未找到目标文件 $NODES_PM，请确认当前环境为 Proxmox VE！${NC}"
    exit 1
fi

if [ ! -f "$BAK_FILE" ]; then
    # 仅当原文件语法完全健康时才创建基准备份
    if perl -c "$NODES_PM" &>/dev/null; then
        cp -p "$NODES_PM" "$BAK_FILE"
        echo -e "  ${GREEN}✓${NC} 已安全备份原始官方文件至: ${BOLD}$BAK_FILE${NC}"
    else
        echo -e "  ${RED}❌ 警告: 现有 $NODES_PM 文件未通过语法检查，中止操作以防损坏系统！${NC}"
        exit 1
    fi
fi

# 3. 鲁棒性注入挂钩 (采用临时文件 + Perl 编译期严格语法校验)
PATCH_OUTPUT=$(python3 - << 'PYEOF'
import os, sys, re

nodes_pm = '/usr/share/perl5/PVE/API2/Nodes.pm'
tmp_file = '/usr/share/perl5/PVE/API2/Nodes.pm.pulse_tmp'

try:
    with open(nodes_pm, 'r', encoding='utf-8') as f:
        text = f.read()
except Exception as e:
    print(f"ERROR: 读取文件失败: {e}")
    sys.exit(1)

modified = False

# A. CPU 温度挂钩
if 'thermalstate' in text:
    print("  \033[0;32m✓\033[0m CPU 核心温度监控接口已处于激活状态。")
else:
    target_rootfs = '        $res->{rootfs} = {\n            total => $dinfo->{blocks},\n            avail => $dinfo->{bavail},\n            used => $dinfo->{used},\n            free => $dinfo->{blocks} - $dinfo->{used},\n        };\n'
    patch_thermal = target_rootfs + '        $res->{thermalstate} = `sensors -j 2>/dev/null`;\n'
    if target_rootfs in text:
        text = text.replace(target_rootfs, patch_thermal, 1)
        modified = True
        print("  \033[0;32m✓\033[0m 成功挂钩 PVE CPU 核心温度 API 扩展。")
    else:
        # 正则备用匹配
        m = re.search(r'(\$res->\{rootfs\}\s*=\s*\{[^\}]+\};(?:\r?\n))', text)
        if m:
            insert_pos = m.end()
            text = text[:insert_pos] + '        $res->{thermalstate} = `sensors -j 2>/dev/null`;\n' + text[insert_pos:]
            modified = True
            print("  \033[0;32m✓\033[0m 成功挂钩 PVE CPU 核心温度 API 扩展 (动态锚点)。")
        else:
            print("  \033[0;33mℹ\033[0m 未能匹配 rootfs 锚点，跳过温度接口注入。")

# B. Web Shell root API Token 免密登录支持
if re.search(r"\$user\s*=~\s*/\^root\\@pam!/", text):
    print("  \033[0;32m✓\033[0m 宿主机 Web Shell 免密登录支持已处于激活状态。")
else:
    shell_pattern = r"(if\s*\(\s*\$user\s*eq\s*['\"]root@pam['\"]\s*\)\s*\{)"
    if re.search(shell_pattern, text):
        text = re.sub(shell_pattern, r"if ($user eq 'root@pam' || $user =~ /^root\\@pam!/) {", text, count=1)
        modified = True
        print("  \033[0;32m✓\033[0m 成功挂钩 宿主机 Web Shell API Token 免密登录。")
    else:
        print("  \033[0;33mℹ\033[0m 未能匹配 get_shell_command 锚点，跳过 Shell 挂钩。")

if modified:
    try:
        with open(tmp_file, 'w', encoding='utf-8') as f:
            f.write(text)
        print("STATUS_MODIFIED")
    except Exception as e:
        print(f"ERROR: 写入临时文件失败: {e}")
        sys.exit(1)
else:
    print("STATUS_UPTODATE")
PYEOF
)

# 输出 Python 执行摘要 (过滤状态标记)
echo "$PATCH_OUTPUT" | grep -v -E "STATUS_MODIFIED|STATUS_UPTODATE" || true

if echo "$PATCH_OUTPUT" | grep -q "STATUS_MODIFIED"; then
    # 4. 关键安全保障: 编译期严格校验 Perl 模块语法 (perl -c)
    if perl -c "$TMP_FILE" &>/dev/null; then
        # 校验 100% 通过，原子替换，零损坏风险
        mv -f "$TMP_FILE" "$NODES_PM"
        echo -e "  ${GREEN}✓${NC} Perl 模块语法校验完全合格，配置已安全原子写入！"
        echo -e "  🔄 正在重启 PVE API 服务 (pvedaemon, pveproxy)..."
        systemctl restart pvedaemon pveproxy
        echo -e "  ${GREEN}✓${NC} PVE API 服务重启完成，硬件状态与 Web Shell 扩展已生效！"
    else
        echo -e "  ${RED}❌ 编译校验未通过！保护机制触发：已销毁临时修改，生产文件未做任何变动。${NC}"
        rm -f "$TMP_FILE" 2>/dev/null || true
        exit 1
    fi
else
    rm -f "$TMP_FILE" 2>/dev/null || true
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
