# Starkproof Frontend (Next.js)

The Starkproof frontend is a scalable, hybrid React application built on Next.js 15 (App Router). It acts as the command center for Exchange Operators to generate Zero-Knowledge proofs, and for the public to cryptographically verify them.

## Technical Stack
- **Framework**: Next.js 15 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Vanilla CSS with custom tokens (No tailwind)
- **State/Web3**: Starknet-React + StarknetJS
- **Blockchain**: Starknet Sepolia
- **Data APIs**: Xverse (Bitcoin), Ethers (Arbitrum/Base Sepolia), Cartridge (Starknet)
- **Charts**: Recharts

---

## Architecture Diagram (Mermaid)

```mermaid
graph TD
    %% Base Network Layer
    subgraph Client [Browser / Frontend Client]
        UI[Next.js React UI]
        Merkle[Client-side Merkle Tree Builder]
        StarknetJS[Starknet.js Provider]
    end

    subgraph API [Next.js API Routes / Serverless]
        RouteHealth[/api/health]
        RouteProofGen[/api/prove]
        RouteVerify[/api/verify]
        RouteProofFetch[/api/proof/:id]
        RouteTunnel[/api/tunnel]
    end

    subgraph LocalProver [Exchange Local Prover Backend]
        ProverExpress[Express.js Server / :8080]
        Scarb[Scarb Cairo Compiler]
        Stwo[Stwo STARK Prover]
    end

    subgraph External [External Services & Chains]
        SN[Starknet Runtime / Sepolia]
        Xverse[Xverse API / Mempool]
        RPC[EVM/Starknet RPCs]
    end

    %% Flow connections
    UI -->|1. Fetch Balances| Xverse
    UI -->|1. Fetch Balances| RPC
    UI -->|2. Build Tree| Merkle
    UI -->|3. Request Proof| RouteProofGen
    UI -->|4. Configure Tunnel| RouteTunnel
    
    RouteProofGen -->|Forward payload| ProverExpress
    RouteVerify -->|Forward payload| ProverExpress
    
    ProverExpress -->|Compile| Scarb
    Scarb -->|Prove| Stwo
    Stwo -->|STARK Proof/Commitment| ProverExpress
    
    ProverExpress -.->|Return Payload| RouteProofGen
    RouteProofGen -.->|Return Payload| UI
    
    UI -->|5. Submit On-Chain| StarknetJS
    StarknetJS -->|Multicall| SN
```

---

## Directory Structure

```text
frontend/
├── app/
│   ├── api/                  # Serverless API endpoints
│   ├── dashboard/            # Operator Dashboard
│   ├── entity/[id]/          # Public entity profile pages
│   ├── onboard/              # Wallet-gated proof generation wizard
│   ├── prove/                # Returning operator proof renewal
│   ├── registry/             # Solvency registry timeline
│   ├── tunnel/               # Hidden tuner for Prover API routing
│   ├── verify/               # Independent public verification tool
│   ├── layout.tsx            # Global layout / StarknetProviders
│   ├── globals.css           # Vanilla CSS tokens & styling
│   └── page.tsx              # Landing page
├── components/               # Resuable UI components (Navbar, Charts, Modals)
├── lib/
│   ├── circuit.ts            # Proof generation lifecycle coordinator
│   ├── merkle.ts             # Poseidon Merkle Tree (CSV parsing)
│   ├── starknet.ts           # Starknet contracts & helpers
│   └── xverse.ts             # Fetching external blockchain balances
└── public/                   # Static assets & diagrams
```

---

## Next.js API Routes

Because proof generation involves compiling Cairo code and running the Stwo prover, generating a proof cannot be fundamentally done inside a browser environment cleanly right now. Therefore, the Next.js API routes act as a **Serverless Proxy / Tunnel** to the Exchange Operator's locally hosted Express.js Prover Backend.

| Route | Method | Description |
|---|---|---|
| `/api/prove` | POST | Proxies the customer liability Merkle Tree and balances to the local prover backend to generate a STARK Proof and commitment. |
| `/api/verify` | POST | Proxies public inputs and a STARK proof bytecode string to the local prover backend to mathematically verify against the Stwo verifier. |
| `/api/proof/[id]` | GET | Fetches the actual STARK proof payload JSON from the local prover for a specific entity. |
| `/api/health` | GET | Heartbeat check to monitor if the local prover API is actively running. |
| `/api/tunnel` | POST/GET | Saves a Next.js HTTP cookie configuring a dynamic URL (`ngrok` tunnel) for the API routes to forward to instead of `localhost`. Used for cloud-deployed UI instances to reach local provers. |

### The Dynamic Tunneling Pattern
Vercel's serverless edge cannot write to local files for state persistence. To allow an Operator to securely link a deployed Starkproof UI (e.g. `https://starkproof.vercel.app`) to their local machine's STARK Prover, we implemented a stateful cookie mechanism:

1. Operator runs Prover on port `8080`.
2. Operator runs `ngrok http 8080` to tunnel it securely.
3. Operator visits `/tunnel` and saves the ngrok URL.
4. Next.js saves an HTTP-only cookie.
5. All subsequent API calls intercept this cookie and dynamically proxy proof generation directly to the Operator's machine.

---

## Sequence Flow: Generating a Proof

```text
OPERATOR (UI)                  NEXT.JS API                  LOCAL PROVER
────────────────             ────────────────             ────────────────
1. Connect Wallet
2. Paste Addresses
3. Upload CSV
4. Run Circuit ──────────────> POST /api/prove ───────────> Build Trace
                                                          Generate STARK
                                                          Verify STARK locally
                             <─────────────────────────── Return Commitment
5. Sign & Submit 
   via StarknetJS
   to Sepolia Network
```