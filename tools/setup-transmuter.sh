#!/usr/bin/env bash
# Setup native Transmuter toolchain for Conker matching decompilation
# Run once on a new machine after cloning the repo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IDO_DIR="$SCRIPT_DIR/ido-native"
IDO_VERSION="v1.2"

echo "=== Conker Transmuter Setup ==="
echo ""

# 1. Install system dependencies
echo "[1/5] Checking system dependencies..."

if ! command -v bun &>/dev/null; then
  echo "  Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi
echo "  ✓ bun $(bun --version)"

if ! command -v pnpm &>/dev/null; then
  echo "  Installing pnpm via Homebrew..."
  brew install pnpm
fi
echo "  ✓ pnpm $(pnpm --version)"

if ! command -v mips-linux-gnu-as &>/dev/null; then
  echo "  Installing mips-linux-gnu-binutils..."
  brew install mips-linux-gnu-binutils
fi
echo "  ✓ mips-linux-gnu-as ($(mips-linux-gnu-as --version | head -1))"

# 2. Download native IDO 5.3 recomp
echo ""
echo "[2/5] Setting up native IDO 5.3 recomp..."

if [ -x "$IDO_DIR/cc" ]; then
  echo "  ✓ Already installed at $IDO_DIR/"
else
  echo "  Downloading from decompals/ido-static-recomp ${IDO_VERSION}..."
  mkdir -p "$IDO_DIR"
  TMP=$(mktemp -d)
  curl -sL "https://github.com/decompals/ido-static-recomp/releases/download/${IDO_VERSION}/ido-5.3-recomp-macos.tar.gz" -o "$TMP/ido.tar.gz"
  tar xzf "$TMP/ido.tar.gz" -C "$IDO_DIR"
  rm -rf "$TMP"
  chmod +x "$IDO_DIR"/*
  echo "  ✓ IDO 5.3 recomp installed"
fi

# Verify
"$IDO_DIR/cc" --version 2>&1 | head -1

# 3. Initialize Transmuter submodule
echo ""
echo "[3/5] Initializing Transmuter submodule..."

cd "$PROJECT_ROOT"
git submodule update --init tools/transmuter

# 4. Install Transmuter dependencies
echo ""
echo "[4/5] Installing Transmuter dependencies..."

cd "$PROJECT_ROOT/tools/transmuter"

# Use npmmirror to bypass corporate registries
if [ ! -f .npmrc ]; then
  echo "registry=https://registry.npmmirror.com/" > .npmrc
fi

pnpm install

# 5. Build Transmuter
echo ""
echo "[5/5] Building Transmuter..."
pnpm run build

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Test with:"
echo "  cd $PROJECT_ROOT"
echo "  bun tools/transmuter/packages/cli/dist/index.js --help"
echo ""
echo "The decomp_permute tool now uses Transmuter natively (~40 compiles/sec)."
