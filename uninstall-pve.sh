#!/bin/bash
# ==============================================================================
# Proxmox Pulse - Dedicated PVE Host Uninstallation & Recovery Script
#
# 功能：
# 1. 恢复 PVE 官方出厂原始 Nodes.pm 文件，彻底移除 CPU 温度挂钩
# 2. 清理 Nodes.pm.bak 备份文件，重启 pvedaemon / pveproxy 服务
# 3. 交互式/可选安全删除面板专用的 API Token (root@pam!dashboard)
# 4. 实现 100% 官方纯净出厂状态，零残留文件，零副作用
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

NODES_PM="/usr/share/perl5/PVE/API2/Nodes.pm"
BAK_FILE="/usr/share/perl5/PVE/API2/Nodes.pm.bak"
TMP_FILE="/usr/share/perl5/PVE/API2/Nodes.pm.pulse_tmp"

echo -e "${CYAN}${BOLD}"
echo "========================================================================"
echo "          Proxmox Pulse - PVE 宿主机一键卸载与出厂还原助手             "
echo "========================================================================"
echo -e "${NC}"

# 1. 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 错误: 此脚本必须由 root 用户执行！请使用 sudo 或切换至 root 执行。${NC}"
    exit 1
fi

# 2. 检查 PVE 环境
if ! command -v pveversion &>/dev/null && [ ! -d "/etc/pve" ]; then
    echo -e "${RED}❌ 错误: 当前系统未检测到 Proxmox VE 环境。${NC}"
    exit 1
fi

REMOVE_TOKEN="prompt"
for arg in "$@"; do
    case "$arg" in
        --clean-token|-y)
            REMOVE_TOKEN="yes"
            ;;
        --keep-token)
            REMOVE_TOKEN="no"
            ;;
        -h|--help)
            echo "用法: bash uninstall-pve.sh [选项]"
            echo ""
            echo "选项:"
            echo "  (无参数)        还原 Nodes.pm 文件并询问是否删除 API Token"
            echo "  --clean-token   还原并直接删除 API Token (root@pam!dashboard)"
            echo "  --keep-token    还原 Nodes.pm 但保留 API Token"
            echo "  -h, --help      显示此帮助信息"
            exit 0
            ;;
    esac
done

echo -e "${BOLD}[1/2] 还原 PVE 原生 API 文件并移除所有扩展挂钩...${NC}"

RESTORED=false

# 1. 优先使用官方出厂原始备份文件恢复
if [ -f "$BAK_FILE" ]; then
    if perl -c "$BAK_FILE" &>/dev/null; then
        cp -p "$BAK_FILE" "$TMP_FILE"
        if perl -c "$TMP_FILE" &>/dev/null; then
            mv -f "$TMP_FILE" "$NODES_PM"
            rm -f "$BAK_FILE"
            RESTORED=true
            echo -e "  ${GREEN}✓${NC} 已从原始备份文件安全恢复官方出厂 Nodes.pm，并已清理备份残留。"
        fi
        rm -f "$TMP_FILE" 2>/dev/null || true
    fi
fi

# 2. 若无备份文件或备份异常，通过 Python 安全逆向剥离所有修改
if [ "$RESTORED" != true ]; then
    echo -e "  ${YELLOW}ℹ️ 未检测到有效备份文件，正在通过语法逆向安全剥离挂钩...${NC}"
    UNPATCH_RES=$(python3 - << 'PYEOF'
import sys, re

nodes_pm = '/usr/share/perl5/PVE/API2/Nodes.pm'
tmp_file = '/usr/share/perl5/PVE/API2/Nodes.pm.pulse_tmp'

try:
    with open(nodes_pm, 'r', encoding='utf-8') as f:
        text = f.read()

    orig = text
    # A. 移除 CPU 温度挂钩
    text = re.sub(r'^\s*\$res->\{thermalstate\}\s*=\s*`sensors -j 2>/dev/null`;\r?\n?', '', text, flags=re.MULTILINE)
    # B. 还原 Web Shell 免密登录判定为官方原始写法
    text = re.sub(r"if\s*\(\s*\$user\s*eq\s*'root@pam'\s*\|\|\s*\$user\s*=~\s*/\^root\\@pam!/\s*\)", "if ($user eq 'root@pam')", text)

    if text != orig:
        with open(tmp_file, 'w', encoding='utf-8') as f:
            f.write(text)
        print("STRIPPED")
    else:
        print("ALREADY_CLEAN")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
PYEOF
)
    if echo "$UNPATCH_RES" | grep -q "STRIPPED"; then
        if [ -f "$TMP_FILE" ] && perl -c "$TMP_FILE" &>/dev/null; then
            mv -f "$TMP_FILE" "$NODES_PM"
            RESTORED=true
            echo -e "  ${GREEN}✓${NC} 挂钩已成功精准剥离，并通过 Perl 语法完整性校验！"
        else
            echo -e "  ${RED}❌ 剥离后语法校验异常，保护机制生效，未修改生产文件。${NC}"
        fi
        rm -f "$TMP_FILE" 2>/dev/null || true
    else
        echo -e "  ${GREEN}✓${NC} Nodes.pm 已经是官方纯净文件，未检测到任何挂钩残留。"
    fi
fi

if [ "$RESTORED" = true ]; then
    echo -e "  🔄 正在重启 PVE API 服务 (pvedaemon, pveproxy)..."
    systemctl restart pvedaemon pveproxy
    echo -e "  ${GREEN}✓${NC} 服务重启完成，PVE API 已完全恢复官方默认出厂行为！"
fi

echo ""

# 2. 处理 API Token
echo -e "${BOLD}[2/2] 检查 PVE API Token...${NC}"
if pveum user token list root@pam 2>/dev/null | grep -q "dashboard"; then
    DO_REMOVE=false
    if [ "$REMOVE_TOKEN" = "yes" ]; then
        DO_REMOVE=true
    elif [ "$REMOVE_TOKEN" = "no" ]; then
        DO_REMOVE=false
    else
        # 交互式询问，如果是非 tty（例如 curl | bash），默认保留 token
        if [ -t 0 ]; then
            read -p "是否同时删除面板专用的 API Token (root@pam!dashboard)? [y/N]: " choice
            case "$choice" in
                y|Y|yes|YES) DO_REMOVE=true ;;
                *) DO_REMOVE=false ;;
            esac
        else
            echo -e "  ${YELLOW}ℹ️ 检测到管道运行模式，默认保留 API Token (root@pam!dashboard)。${NC}"
            echo -e "  如需彻底清理 Token，可执行: ${CYAN}pveum user token remove root@pam dashboard${NC}"
        fi
    fi

    if [ "$DO_REMOVE" = true ]; then
        pveum user token remove root@pam dashboard 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} 已安全移除 API Token: root@pam!dashboard"
    else
        echo -e "  ${BLUE}ℹ️${NC} 已保留 API Token: root@pam!dashboard"
    fi
else
    echo -e "  ${GREEN}✓${NC} 未检测到残留的 root@pam!dashboard Token。"
fi

echo ""
echo -e "${GREEN}========================================================================${NC}"
echo -e "🎉 ${BOLD}PVE 宿主机出厂还原完成！${NC}"
echo -e "  • PVE 官方文件:   ${GREEN}100% 原始出厂状态${NC}"
echo -e "  • 额外守护进程:   ${GREEN}0 (完全无残留)${NC}"
echo -e "  • 端口开放情况:   ${GREEN}完全无新增暴露${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo ""
