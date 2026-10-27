#!/bin/bash
# 兼容旧版本链接，自动调用全新的全能后端配置助手 setup-pve.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
if [ -f "$SCRIPT_DIR/setup-pve.sh" ]; then
    bash "$SCRIPT_DIR/setup-pve.sh" "$@"
else
    curl -sSL https://raw.githubusercontent.com/cuicui-V5/proxmox-pulse/main/setup-pve.sh | bash -s -- "$@"
fi
