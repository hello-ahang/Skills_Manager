#!/bin/bash

# Skills Manager 一键卸载脚本
# 清理项目目录、本地用户数据、shell 别名

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
USER_DATA_DIR="$HOME/.skills-manager"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      ⚠️  Skills Manager 卸载程序         ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  将清除以下内容：                         ║"
echo "║  1. 项目目录: $INSTALL_DIR"
echo "║  2. 用户数据: $USER_DATA_DIR"
echo "║  3. Shell 别名: sm_run / sm_stop         ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 二次确认
read -p "$(echo -e ${RED}确认卸载？此操作不可撤销！${NC} [y/N]: )" confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo -e "${GREEN}已取消卸载${NC}"
    exit 0
fi

echo ""

# 1. 停止运行中的服务
echo -e "${YELLOW}[1/4]${NC} 停止运行中的服务..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5174 | xargs kill -9 2>/dev/null || true
echo -e "${GREEN}✓${NC} 服务已停止"

# 2. 清除 shell 别名
echo -e "${YELLOW}[2/4]${NC} 清除 Shell 别名..."
for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [ -f "$rc" ]; then
        sed -i '' '/# ===== Skills Manager =====/,/# ===== End Skills Manager =====/d' "$rc" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} 已清除 $(basename $rc) 中的别名"
    fi
done

# 3. 删除用户数据目录
echo -e "${YELLOW}[3/4]${NC} 删除用户数据..."
if [ -d "$USER_DATA_DIR" ]; then
    rm -rf "$USER_DATA_DIR"
    echo -e "${GREEN}✓${NC} 已删除 $USER_DATA_DIR"
else
    echo -e "${GREEN}✓${NC} 用户数据目录不存在，跳过"
fi

# 4. 删除项目目录（最后执行，因为脚本本身在项目目录中）
echo -e "${YELLOW}[4/4]${NC} 删除项目目录..."
cd "$HOME"
rm -rf "$INSTALL_DIR"
echo -e "${GREEN}✓${NC} 已删除 $INSTALL_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║          ✅ 卸载完成！                    ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  请重新打开终端以使别名清除生效            ║"
echo "║  感谢使用 Skills Manager 👋              ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
