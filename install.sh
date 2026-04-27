#!/bin/bash
# ============================================================
# Skills Manager - 一键安装脚本
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     Skills Manager - 一键安装脚本        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. 检查 Node.js
echo -e "${YELLOW}[1/4]${NC} 检查环境..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ 未检测到 Node.js，请先安装 Node.js 20+${NC}"
    echo "  推荐: brew install node 或访问 https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}✗ Node.js 版本过低 (当前: $(node -v))，需要 20+${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"
echo -e "${GREEN}✓${NC} npm $(npm -v)"

# 2. 安装依赖
echo ""
echo -e "${YELLOW}[2/4]${NC} 安装依赖..."
npm install
echo -e "${GREEN}✓${NC} 依赖安装完成"

# 3. 初始化数据目录
echo ""
echo -e "${YELLOW}[3/5]${NC} 初始化数据..."
mkdir -p data
if [ ! -f data/config.json ]; then
    cp data/config.example.json data/config.json 2>/dev/null || echo '{}' > data/config.json
    echo -e "${GREEN}✓${NC} 已创建默认项目配置"
else
    echo -e "${GREEN}✓${NC} 项目配置文件已存在，跳过"
fi

# 4. 初始化用户数据目录
echo ""
echo -e "${YELLOW}[4/5]${NC} 初始化用户数据目录..."
USER_DATA_DIR="$HOME/.skills-manager"
mkdir -p "$USER_DATA_DIR"
if [ ! -f "$USER_DATA_DIR/user-config.json" ]; then
    echo '{"sourceDir":"","sourceDirs":[],"activeSourceDirId":"","llmModels":[],"projects":[],"dismissedPaths":[]}' > "$USER_DATA_DIR/user-config.json"
    echo -e "${GREEN}✓${NC} 已创建用户配置 (~/.skills-manager/user-config.json)"
else
    echo -e "${GREEN}✓${NC} 用户配置已存在，跳过"
fi
echo -e "  ${YELLOW}ℹ${NC} 用户数据（API 密钥、模型配置等）存储在: $USER_DATA_DIR/"

# 5. 注册快捷命令
echo ""
echo -e "${YELLOW}[5/5]${NC} 注册快捷命令..."
INSTALL_DIR=$(cd "$(dirname "$0")" && pwd)
SHELL_RC=""

if [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ]; then
    # 移除旧的 Skills Manager 配置（如果有）
    sed -i '' '/# ===== Skills Manager =====/,/# ===== End Skills Manager =====/d' "$SHELL_RC" 2>/dev/null || true

    cat >> "$SHELL_RC" << EOF

# ===== Skills Manager =====
alias sm='cd ${INSTALL_DIR} && echo "🚀 启动 Skills Manager..." && npm run dev'
alias sm-stop='cd ${INSTALL_DIR} && echo "🛑 停止 Skills Manager..." && npm run stop'
# ===== End Skills Manager =====
EOF
    echo -e "${GREEN}✓${NC} 已注册快捷命令到 $(basename $SHELL_RC)"
else
    echo -e "${YELLOW}⚠${NC} 未找到 .zshrc 或 .bashrc，请手动添加以下别名："
    echo "  alias sm='cd ${INSTALL_DIR} && npm run dev'"
    echo "  alias sm-stop='cd ${INSTALL_DIR} && npm run stop'"
fi

# 完成
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║          ✅ 安装完成！                    ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  启动: sm      (或 npm run dev)          ║"
echo "║  停止: sm-stop (或 npm run stop)         ║"
echo "║                                          ║"
echo "║  前端: http://localhost:5173              ║"
echo "║  API:  http://localhost:3001              ║"
echo "║                                          ║"
echo "║  ⚠ 新开终端或执行 source ~/.zshrc 生效   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
