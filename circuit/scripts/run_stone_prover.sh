#!/bin/bash
# ==============================================================================
# Starkproof — True ZK Proving Pipeline using Scarb + Stwo
# ==============================================================================
# Called by prover_api/server.js with:
#   ARGUMENTS  env var  — serialised felt252 array for the circuit
#   PROOF_OUT  env var  — output path for the proof file (default: proof.json)
# ==============================================================================
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

ARGUMENTS="${ARGUMENTS:-[]}"
PROOF_OUT="${PROOF_OUT:-proof.json}"

echo ">> [1/4] Compiling circuit with Scarb..."
scarb build

echo ">> [2/4] Executing circuit (scarb-execute) to produce execution trace..."
# scarb-execute runs the #[executable] function and writes
# an execution trace to target/execute/<pkg>/<id>/
EXEC_OUTPUT=$(scarb execute \
  --executable-name starkproof \
  --arguments "$ARGUMENTS" \
  --output standard \
  --json 2>&1)

echo "$EXEC_OUTPUT"

# Extract the execution-id from the JSON output
EXECUTION_ID=$(echo "$EXEC_OUTPUT" | grep -o '"execution_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$EXECUTION_ID" ]; then
  # Fallback: find the latest execution directory
  EXEC_DIR=$(ls -td target/execute/starkproof_circuit/*/ 2>/dev/null | head -1)
  EXECUTION_ID=$(basename "$EXEC_DIR")
fi

echo "   Execution ID: $EXECUTION_ID"

echo ">> [3/4] Generating Stwo STARK proof (scarb-prove)..."
scarb prove \
  --executable-name starkproof \
  --execution-id "$EXECUTION_ID"

# The proof lands in target/proofs/<execution-id>/proof.json  
PROOF_SRC=$(find target -name "proof.json" | grep "$EXECUTION_ID" | head -1)
if [ -z "$PROOF_SRC" ]; then
  PROOF_SRC=$(find target -name "proof.json" | head -1)
fi

if [ ! -f "$PROOF_SRC" ]; then
  echo "ERROR: Proof file not found after scarb prove"
  exit 1
fi

cp "$PROOF_SRC" "$PROOF_OUT"
echo ">> Proof saved to: $PROOF_OUT"
echo ">> [4/4] Done."
