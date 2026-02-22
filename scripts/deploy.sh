#!/usr/bin/env bash
# Starkproof — Automated deployment script for Starknet Sepolia
# Run this AFTER funding the account at https://starknet-faucet.vercel.app/

set -euo pipefail

export PATH="$HOME/.asdf/shims:$HOME/.asdf/bin:$PATH"

ACCOUNT_NAME="starkproof"
ACCOUNT_ADDRESS="0x05deb262099b4a36556b7d57b005768785014ded07ace25e793d9f1a664dd3ad"
NETWORK="sepolia"
CONTRACTS_DIR="$(cd "$(dirname "$0")/../contracts" && pwd)"
FRONTEND_ENV="$(cd "$(dirname "$0")/../frontend" && pwd)/.env.local"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║        Starkproof — Starknet Deployment          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Account : $ACCOUNT_ADDRESS"
echo "Network : $NETWORK"
echo ""

cd "$CONTRACTS_DIR"

# ─── Step 1: Check build ──────────────────────────────────────────────────────
echo "▶ [1/5] Verifying contract builds..."
scarb build
echo "   ✓ Contracts compiled cleanly"

# ─── Step 2: Deploy account ───────────────────────────────────────────────────
echo ""
echo "▶ [2/5] Deploying account on Starknet Sepolia..."
DEPLOY_OUT=$(sncast account deploy --network "$NETWORK" --name "$ACCOUNT_NAME" 2>&1 || true)
echo "$DEPLOY_OUT"
if echo "$DEPLOY_OUT" | grep -q "Already"; then
  echo "   ℹ Account already deployed, continuing..."
elif echo "$DEPLOY_OUT" | grep -q "Success\|transaction_hash"; then
  echo "   ✓ Account deployed"
else
  echo ""
  echo "   ⚠ Account deploy failed or pending — check balance at:"
  echo "   https://sepolia.starkscan.co/contract/$ACCOUNT_ADDRESS"
  exit 1
fi

# ─── Step 3: Declare + deploy ReservesRegistry ───────────────────────────────
echo ""
echo "▶ [3/5] Declaring ReservesRegistry contract..."
DECLARE_OUT=$(sncast --account "$ACCOUNT_NAME" declare \
  --contract-name ReservesRegistry \
  --network "$NETWORK" 2>&1)
echo "$DECLARE_OUT"

REGISTRY_CLASS=$(echo "$DECLARE_OUT" | grep -oE 'class_hash: 0x[0-9a-f]+' | awk '{print $2}' | head -1)
if [ -z "$REGISTRY_CLASS" ]; then
  # Maybe already declared — try to extract from error message
  REGISTRY_CLASS=$(echo "$DECLARE_OUT" | grep -oE '0x[0-9a-f]{60,}' | head -1)
fi
echo "   Class hash: $REGISTRY_CLASS"

echo ""
echo "▶ [3/5] Deploying ReservesRegistry..."
DEPLOY_REG=$(sncast --account "$ACCOUNT_NAME" deploy \
  --class-hash "$REGISTRY_CLASS" \
  --constructor-calldata "$ACCOUNT_ADDRESS" \
  --network "$NETWORK" 2>&1)
echo "$DEPLOY_REG"

REGISTRY_ADDR=$(echo "$DEPLOY_REG" | grep -oE 'contract_address: 0x[0-9a-f]+' | awk '{print $2}' | head -1)
if [ -z "$REGISTRY_ADDR" ]; then
  REGISTRY_ADDR=$(echo "$DEPLOY_REG" | grep -oE '0x[0-9a-f]{60,}' | head -1)
fi
echo "   ✓ ReservesRegistry deployed at: $REGISTRY_ADDR"

# ─── Step 4: Declare + deploy ProofScheduler ─────────────────────────────────
echo ""
echo "▶ [4/5] Declaring ProofScheduler contract..."
DECLARE_SCHED=$(sncast --account "$ACCOUNT_NAME" declare \
  --contract-name ProofScheduler \
  --network "$NETWORK" 2>&1)
echo "$DECLARE_SCHED"

SCHED_CLASS=$(echo "$DECLARE_SCHED" | grep -oE 'class_hash: 0x[0-9a-f]+' | awk '{print $2}' | head -1)
if [ -z "$SCHED_CLASS" ]; then
  SCHED_CLASS=$(echo "$DECLARE_SCHED" | grep -oE '0x[0-9a-f]{60,}' | head -1)
fi

echo ""
echo "▶ [4/5] Deploying ProofScheduler..."
DEPLOY_SCHED=$(sncast --account "$ACCOUNT_NAME" deploy \
  --class-hash "$SCHED_CLASS" \
  --constructor-calldata "$REGISTRY_ADDR" \
  --network "$NETWORK" 2>&1)
echo "$DEPLOY_SCHED"

SCHED_ADDR=$(echo "$DEPLOY_SCHED" | grep -oE 'contract_address: 0x[0-9a-f]+' | awk '{print $2}' | head -1)
if [ -z "$SCHED_ADDR" ]; then
  SCHED_ADDR=$(echo "$DEPLOY_SCHED" | grep -oE '0x[0-9a-f]{60,}' | head -1)
fi
echo "   ✓ ProofScheduler deployed at: $SCHED_ADDR"

# ─── Step 5: Update .env.local ───────────────────────────────────────────────
echo ""
echo "▶ [5/5] Updating frontend/.env.local with deployed addresses..."

if [ -n "$REGISTRY_ADDR" ] && [ -n "$SCHED_ADDR" ]; then
  sed -i '' \
    -e "s|NEXT_PUBLIC_REGISTRY_ADDRESS=.*|NEXT_PUBLIC_REGISTRY_ADDRESS=$REGISTRY_ADDR|" \
    -e "s|NEXT_PUBLIC_SCHEDULER_ADDRESS=.*|NEXT_PUBLIC_SCHEDULER_ADDRESS=$SCHED_ADDR|" \
    -e "s|RESERVES_REGISTRY_ADDRESS=.*|RESERVES_REGISTRY_ADDRESS=$REGISTRY_ADDR|" \
    -e "s|PROOF_SCHEDULER_ADDRESS=.*|PROOF_SCHEDULER_ADDRESS=$SCHED_ADDR|" \
    "$FRONTEND_ENV"
  echo "   ✓ .env.local updated"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              DEPLOYMENT COMPLETE                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  ReservesRegistry : $REGISTRY_ADDR"
echo "  ProofScheduler   : $SCHED_ADDR"
echo ""
echo "  Starkscan:  https://sepolia.starkscan.co/contract/$REGISTRY_ADDR"
echo ""
echo "  Restart the frontend to pick up the new addresses:"
echo "  $ cd frontend && npm run dev"
echo ""
