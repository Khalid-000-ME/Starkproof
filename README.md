# zkReserves

> Private Proof of Solvency on Starknet
> Hackathon: Re{define} -- Privacy & Bitcoin on Starknet
> Tracks: Privacy + Bitcoin
> Stack: Cairo 2.15 · Next.js 16 · Xverse API · StarknetJS · Braavos Wallet

zkReserves is a trustless, cross-chain, privacy-preserving Proof of Reserves protocol
built on Starknet. Any digital asset-holding entity — exchanges, funds, custodians
— can cryptographically prove their reserves (Bitcoin, Ethereum, USDC) exceed customer
liabilities, without revealing wallet addresses, exact balances, or any
customer-identifying information.

The latest enhancements integrate native multi-chain support (Bitcoin via Xverse, EVM chains via public RPCs),
and Native STARK verification utilizing Starkware's powerful Stwo prover as an independent verification layer.

---

## System Overview

```
                           zkReserves
  ═══════════════════════════════════════════════════════════════════

   EXCHANGE OPERATOR                       PUBLIC / ANYONE
   ─────────────────                       ────────────────
   1. Register entity                      Browse the registry
   2. Add BTC/ETH/USDC addresses           View live solvency status
   3. Upload liability CSV                 Verify individual inclusion
   4. Run ZK circuit (Stwo Prover)         Download audit reports
   5. Submit proof to Starknet
   6. Renew every 28 days

              │                                   │
              ▼                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                   STARKNET SEPOLIA                           │
   │                                                              │
   │   ReservesRegistry.cairo                                     │
   │   ├── register_entity(name_hash) → entity_id                │
   │   ├── submit_proof(entity_id, public_inputs, commitment)     │
   │   ├── get_entity_count() → u32                              │
   │   ├── get_entity_id_at(index) → felt252                     │
   │   ├── get_proof_record(entity_id) → ProofRecord             │
   │   └── get_status(entity_id) → Active | Expiring | Expired   │
   │                                                              │
   │   ProofScheduler.cairo                                       │
   │   ├── get_expiring_soon() → [entity_ids]                    │
   │   └── get_ecosystem_health() → EcosystemHealth              │
   └──────────────────────────────────────────────────────────────┘

  ═══════════════════════════════════════════════════════════════════
```

---

## Application Structure (New Design)

```
  zkReserves Application -- Page Map
  ════════════════════════════════════════════════════════

  /                        Landing page
  │                        Marketing, value proposition,
  │                        CTA to register or verify
  │
  ├── /registry            Public solvency registry
  │                        Live status table for all entities
  │                        Block ticker, ecosystem health
  │
  ├── /onboard             Exchange onboarding wizard
  │   │                    Wallet-gated. Step-by-step first
  │   │                    time setup for new operators.
  │   │
  │   ├── Step 1           Connect Starknet wallet (Braavos)
  │   ├── Step 2           Name your entity + preview entity_id
  │   ├── Step 3           Add cold wallet addresses (BTC/ETH/USDC across EVM L2s)
  │   ├── Step 4           Upload customer liability CSV
  │   ├── Step 5           Run ZK circuit Native Stwo Prover
  │   └── Step 6           Sign and submit to Starknet
  │
  ├── /dashboard           Operator dashboard (wallet-gated)
  │                        Shows current entity for connected wallet
  │                        Proof history, expiry countdown, renewal CTA
  │                        Reserve band trend chart
  │
  ├── /prove               Streamlined re-proof page
  │                        For returning operators doing periodic renewal
  │                        Entity pre-filled from wallet. CSV upload,
  │                        circuit run, sign, submit.
  │
  ├── /entity/[id]         Public entity profile
  │                        Full proof history timeline
  │                        Reserve band trend
  │                        Merkle root history
  │                        Inclusion verification widget
  │
  └── /verify              Auditor verification tool
                           Paste proof commitment + public inputs
                           Independent cryptographic verification
                           No trust in zkReserves frontend required

  ════════════════════════════════════════════════════════
```

---

## User Journey -- Exchange Operator

```
  NEW OPERATOR FLOW
  ──────────────────────────────────────────────────────────────────

  Visit /                 Read how it works
       │
       ▼
  /onboard Step 1         Connect Braavos wallet to Sepolia
       │
       ▼
  /onboard Step 2         Enter exchange name
                          Preview entity_id = Poseidon(name_hash, address)
       │
       ▼
  /onboard Step 3         Add BTC/EVM cold wallet addresses (one per line)
                          Xverse API fetches live confirmed BTC balances
                          Ethers.js fetches ETH/USDC balances via RPCs
       │
       ▼
  /onboard Step 4         Upload customer liability CSV
                          Format: account_id, liability_satoshi
                          Merkle tree built client-side (private)
       │
       ▼
  /onboard Step 5         ZK circuit runs in browser
                          Proves: reserves >= liabilities
                          Commits: liability_merkle_root
                          Assigns: reserve_ratio_band
       │
       ▼
  /onboard Step 6         Sign multicall in Braavos:
                          [register_entity, submit_proof]
                          Proof commitment and public inputs
                          stored permanently on Starknet
       │
       ▼
  /dashboard              Operator home from now on.
                          Status: Active. Expires in 28 days.
                          Renew button visible 3 days before expiry.

  ──────────────────────────────────────────────────────────────────

  RETURNING OPERATOR FLOW (proof renewal)
  ──────────────────────────────────────────────────────────────────

  /dashboard              Expiry warning: "Proof expires in 2 days"
       │
       ▼
  /prove                  BTC addresses pre-filled
                          Upload fresh liability CSV
                          Re-run circuit
                          Sign and submit
       │
       ▼
  /dashboard              Updated. Now valid for another 28 days.

  ──────────────────────────────────────────────────────────────────
```

---

## User Journey -- Public Verifier

```
  PUBLIC VERIFICATION FLOW
  ──────────────────────────────────────────────────────────────────

  /registry               Browse all registered entities
                          See live Active / Expiring / Expired status
       │
       ▼
  /entity/[id]            Click any entity to view:
                          - Proof submission history
                          - Reserve band trend over time
                          - Last attested BTC block height
                          - Merkle root for each proof period
       │
       ▼
  /entity/[id]            Use inclusion verifier widget:
            (with         Paste your account_id + balance →
            branches)     Re-compute Merkle branch →
                          Compare to on-chain root →
                          Confirmed: your balance was included

  ──────────────────────────────────────────────────────────────────
```

---

## Zero-Knowledge Circuit

```
  PRIVATE INPUTS (never leave the browser)       PUBLIC INPUTS (on-chain)
  ─────────────────────────────────────────       ───────────────────────

  BTC/ETH/USDC addresses                   ─────> entity_id
  Live confirmed balances                         block_height
  Customer account IDs                            liability_merkle_root
  Customer liability amounts               ─────> reserve_ratio_band
                                                  proof_timestamp
             │
             ▼
  ┌─────────────────────────────────────┐
  │     Cairo ZK Circuit (browser)     │
  │                                     │
  │  1. total_reserves = sum(balances)  │
  │  2. Build Poseidon Merkle tree      │
  │     from (account_id, liability)    │
  │     pairs                           │
  │  3. total_liabilities = sum(leaves) │
  │  4. ASSERT reserves >= liabilities  │
  │     (circuit fails if false)        │
  │  5. band = classify(ratio)          │
  │  6. commitment = Poseidon(          │
  │       entity_id, block_height,      │
  │       root, band, timestamp)        │
  └──────────────┬──────────────────────┘
                 │
                 ▼
        proof_commitment (felt252)
        Submitted to Starknet with
        public inputs. Anyone can
        verify the commitment matches.
```

---

## Reserve Ratio Bands

```
  Band 0   Insolvent     < 100%    Circuit fails. No proof possible.
  Band 1   Solvent       100-110%  Minimum viable. Warning threshold.
  Band 2   Comfortable   110-120%  Acceptable buffer.
  Band 3   Strong        >= 120%   Overcollateralized. Preferred.
```

---

## Merkle Commitment Scheme

```
  Customer liability data is committed using Poseidon-based binary Merkle:

        Root = liability_merkle_root (published on Starknet)
        /                           \
     Node_A                       Node_B
     /    \                       /    \
  Leaf_0  Leaf_1              Leaf_2  Leaf_3
    |       |                   |       |
  P(id0,  P(id1,            P(id2,  P(id3,
   bal0)   bal1)             bal2)   bal3)

  P = Poseidon hash

  Individual users can verify their inclusion by:
  1. Getting their Merkle branch from the exchange
  2. Computing: Poseidon(their_id, their_balance) = their_leaf
  3. Walking up the branch to compute the root
  4. Comparing to on-chain liability_merkle_root
```

---

## Automation Candidates (AI Agent Layer)

```
  AGENT 1 -- Proof Renewal Watchdog
  ─────────────────────────────────
  Polls Starknet every 24 hours.
  Alerts operator when proof expires in <= 3 days.
  Can trigger automated re-proof with pre-configured wallets.
  Endpoint: /api/scheduler/check-expiry

  AGENT 2 -- Liability CSV Ingestor
  ──────────────────────────────────
  Connects to exchange internal DB.
  Queries user balances nightly.
  Auto-formats into account_id,liability_satoshi CSV.
  Sends to /api/proof/generate without manual intervention.

  AGENT 3 -- Ecosystem Watchdog
  ──────────────────────────────
  Monitors reserve_ratio_band across all entities.
  Alerts if band drops from 3 -> 2 -> 1 over submissions.
  Publishes Discord/Telegram notifications.
  Endpoint: /api/ecosystem/stats

  AGENT 4 -- Audit Report Generator
  ───────────────────────────────────
  On proof submission, reads public inputs from Starknet.
  Generates formal PDF audit report via LLM.
  Publishable by the exchange as compliance documentation.
```

---

## Tech Stack

```
  Layer              Technology
  ─────────────────────────────────────────────────────────────
  ZK Contracts       Cairo 2.15 (Starknet native)
  Proof Circuit      Cairo (compiled to STARK-verifiable bytecode)
  Stark Prover       Stwo Native Prover (True ZK backend)
  Frontend           Next.js 16 (App Router, Turbopack)
  Styling            Vanilla CSS (design tokens, no framework)
  Icons              Heroicons / Phosphor Icons (no emojis)
  Wallet             Braavos (Starknet Sepolia)
  Chain Data         Xverse Bitcoin API, Ethers.js multi-chain RPCs
  Hashing            Poseidon (native to Starknet/Cairo)
  Deployment         Starknet Sepolia (testnet)
  ─────────────────────────────────────────────────────────────
```

---

## Project Structure

```
  zkReserves/
  ├── contracts/
  │   ├── src/
  │   │   ├── reserves_registry.cairo    Registry contract
  │   │   ├── proof_scheduler.cairo      Expiry and health tracking
  │   │   └── lib.cairo                  Module declarations
  │   └── Scarb.toml
  │
  ├── circuit/
  │   ├── src/
  │   │   ├── merkle.cairo               Poseidon Merkle tree
  │   │   ├── constraints.cairo          Solvency assertions
  │   │   └── band.cairo                 Reserve ratio band classification
  │   └── Scarb.toml
  │
  ├── frontend/
  │   ├── app/
  │   │   ├── page.tsx                   Landing page (/)
  │   │   ├── registry/page.tsx          Public registry (/registry)
  │   │   ├── onboard/page.tsx           Operator onboarding (/onboard)
  │   │   ├── dashboard/page.tsx         Operator dashboard (/dashboard)
  │   │   ├── prove/page.tsx             Proof renewal wizard (/prove)
  │   │   ├── entity/[id]/page.tsx       Entity public profile
  │   │   ├── verify/page.tsx            Manual verification tool
  │   │   └── api/
  │   │       ├── proof/generate/        ZK proof generation
  │   │       ├── proof/submit/          Starknet submission relay
  │   │       ├── entity/[id]/status/    Entity status query
  │   │       ├── ecosystem/stats/       Aggregate ecosystem stats
  │   │       ├── scheduler/             Renewal watchdog endpoint
  │   │       └── verify/manual/         Manual verification logic
  │   │
  │   ├── components/
  │   │   ├── Navbar.tsx                 Top navigation (wallet-aware)
  │   │   ├── EntityTable.tsx            Registry table component
  │   │   ├── ProofStatusBadge.tsx       Active/Expiring/Expired badge
  │   │   ├── ReserveRatioBand.tsx       Band visualization
  │   │   ├── ProofTimeline.tsx          Proof history chart
  │   │   ├── LiveBlockTicker.tsx        BTC block height ticker
  │   │   ├── EcosystemHealthBanner.tsx  Health summary bar
  │   │   └── charts/
  │   │       ├── ProofTimeline.tsx      Recharts timeline
  │   │       └── RatioDistribution.tsx  Band distribution chart
  │   │
  │   ├── lib/
  │   │   ├── starknet.ts                Contract ABI, provider, addresses
  │   │   ├── merkle.ts                  Client-side Poseidon Merkle
  │   │   ├── circuit.ts                 ZK circuit runner (WASM)
  │   │   └── xverse.ts                  Xverse Bitcoin RPC client
  │   │
  │   └── public/
  │       └── diagrams/
  │           ├── user-flow.md            Mermaid: operator + verifier flows
  │           ├── system-architecture.md  Mermaid: full system diagram
  │           └── proof-lifecycle.md      Mermaid: proof state machine
  │
  └── README.md
```

---

## Setup and Installation

### Prerequisites

- Node.js 18+
- Scarb (Cairo compiler): `curl --proto '=https' --tlsv1.2 -sSf https://sh.starkup.sh | sh`
- sncast (Starknet Foundry): installed alongside Scarb via Starkup
- Braavos wallet browser extension (set to Starknet Sepolia)

### 1. Install Frontend Dependencies

```bash
cd frontend && npm install
```

### 2. Configure Environment

```bash
cp .env.example frontend/.env.local
# Set NEXT_PUBLIC_REGISTRY_ADDRESS
# Set NEXT_PUBLIC_STARKNET_RPC
# Set XVERSE_API_KEY (optional)
```

### 3. Build Cairo Contracts

```bash
cd contracts && scarb build
cd ../circuit && scarb build
```

### 4. Deploy Contracts to Starknet Sepolia

```bash
cd contracts
sncast account create --network=sepolia --name=zkreserves
# Fund account at https://starknet-faucet.vercel.app/
sncast account deploy --network sepolia --name zkreserves --silent

# Deploy ReservesRegistry
sncast --account=zkreserves declare --contract-name=ReservesRegistry --network=sepolia
sncast --account=zkreserves deploy \
  --class-hash=<CLASS_HASH> \
  --constructor-calldata=<YOUR_ACCOUNT_ADDRESS> \
  --network=sepolia

# Deploy ProofScheduler
sncast --account=zkreserves declare --contract-name=ProofScheduler --network=sepolia
sncast --account=zkreserves deploy \
  --class-hash=<CLASS_HASH> \
  --constructor-calldata=<REGISTRY_ADDRESS> \
  --network=sepolia
```

### 5. Run Frontend

```bash
cd frontend && npm run dev
```

Open http://localhost:3000

---

## Deployed Contracts (Starknet Sepolia)

| Contract          | Address                                                              |
|-------------------|----------------------------------------------------------------------|
| ReservesRegistry  | 0x05128d4d6dc00fa4faa7bdf53398d377c0f4b81519c0df15ec1f7ff53fc6f152 |
| ProofScheduler    | 0x0055a7610b71fd44dadb8d2042305341191a86a585cd52d355906d4d598ec9cb |

Starkscan: https://sepolia.voyager.online/contract/0x05128d4d6dc00fa4faa7bdf53398d377c0f4b81519c0df15ec1f7ff53fc6f152

---

## Security Model

What the protocol guarantees:

- Soundness: No valid proof can be generated for an insolvent entity.
  The Cairo circuit's solvency assertion is mathematically unforgeable.
- Zero-knowledge: Wallet addresses, exact balances, and customer data
  never leave the operator's browser. Only commitments go on-chain.
- Commitment binding: Once liability_merkle_root is published on Starknet,
  customer data cannot be silently altered without invalidating the root.
- Time-bounded: Proofs expire after 28 days. Silence is a public red flag.
- On-chain transparency: Proof status, band, and Merkle root are readable
  by anyone querying the Starknet contract. No trust in zkReserves UI needed.

What the protocol does NOT guarantee:

- Completeness of liability disclosure (operator could omit customers)
- Real-time balance (small window between attested block and submission)
- That the Bitcoin addresses are actually controlled by the exchange

---

## License

MIT
