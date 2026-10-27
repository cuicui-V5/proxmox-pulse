#!/bin/bash
# ==============================================================================
# Proxmox Pulse - Native PVE CPU Temperature API Hook
# 
# 优雅的原生 PVE CPU 温度扩展：
# 通过向 PVE 官方 REST API (/nodes/{node}/status) 注入轻量传感器读取逻辑，
# 使面板仅通过现有的 API Token (8006 端口) 即可获取 CPU 各核心实时温度。
# 无需开放 SSH 端口，无需密码，无网络开销，零破坏性。
# ==============================================================================

set -e

NODES_PM="/usr/share/perl5/PVE/API2/Nodes.pm"
BAK_FILE="/usr/share/perl5/PVE/API2/Nodes.pm.bak"

# 1. 检查 lm-sensors
if ! command -v sensors &>/dev/null; then
    echo "📦 检测到未安装 lm-sensors，正在安装..."
    apt-get update -qq && apt-get install -y -qq lm-sensors >/dev/null
    echo "✅ lm-sensors 安装完成。"
fi

# 2. 卸载逻辑
if [ "$1" == "uninstall" ]; then
    if [ -f "$BAK_FILE" ]; then
        cp "$BAK_FILE" "$NODES_PM"
        systemctl restart pvedaemon pveproxy
        echo "✅ PVE 原生温度 API 扩展已成功卸载，恢复官方原始文件。"
    else
        echo "❌ 未找到备份文件 $BAK_FILE"
    fi
    exit 0
fi

# 3. 检查是否已安装
if grep -q "thermalstate" "$NODES_PM"; then
    echo "✅ PVE 原生温度 API 扩展已就绪 (无需重复安装)。"
    exit 0
fi

# 4. 备份原文件
cp "$NODES_PM" "$BAK_FILE"

# 5. 安全注入
python3 - << 'PYEOF'
with open('/usr/share/perl5/PVE/API2/Nodes.pm', 'r') as f:
    text = f.read()

target = '        $res->{rootfs} = {\n            total => $dinfo->{blocks},\n            avail => $dinfo->{bavail},\n            used => $dinfo->{used},\n            free => $dinfo->{blocks} - $dinfo->{used},\n        };\n'
patch = target + '        $res->{thermalstate} = `sensors -j 2>/dev/null`;\n'

if target in text:
    new_text = text.replace(target, patch, 1)
    with open('/usr/share/perl5/PVE/API2/Nodes.pm', 'w') as f:
        f.write(new_text)
    print("✅ 成功注入 PVE thermalstate API 挂钩。")
else:
    print("❌ 未能定位插入锚点，请检查 PVE 版本。")
    exit(1)
PYEOF

# 6. 重启 PVE API 服务
systemctl restart pvedaemon pveproxy
echo "🎉 安装完成！现在 /api2/json/nodes/{node}/status 已原生包含 CPU 温度数据。"
