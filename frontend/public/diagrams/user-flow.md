# User Flow Diagrams

## Exchange Operator Flow

```mermaid
flowchart TD
    A([Visit Starkproof]) --> B{First time?}

    B -->|Yes| C[/onboard]
    B -->|No| D[/dashboard]

    subgraph Onboarding [Operator Onboarding -- /onboard]
        C --> C1[Step 1\nConnect Braavos wallet\nStarknet Sepolia]
        C1 --> C2[Step 2\nEnter exchange name\nPreview entity_id]
        C2 --> C3[Step 3\nAdd Bitcoin wallet addresses\nXverse API fetches balances]
        C3 --> C4[Step 4\nUpload customer liability CSV\nMerkle tree built in browser]
        C4 --> C5[Step 5\nRun ZK circuit\nProves reserves >= liabilities]
        C5 --> C6{Circuit result}
        C6 -->|Proof generated| C7[Step 6\nSign multicall in Braavos\nregister_entity + submit_proof]
        C6 -->|Assertion failed\nInsolvent| C8[Error: Cannot generate proof\nReserves insufficient]
        C7 --> D
    end

    subgraph Dashboard [Operator Dashboard -- /dashboard]
        D --> D1{Proof status?}
        D1 -->|Active\nExpires > 3 days| D2[Show current status\nReserve band chart\nProof history]
        D1 -->|Expiring\nExpires <= 3 days| D3[Renewal warning\nRenew Now button]
        D1 -->|Expired| D4[Expired warning\nRenew Now button]
        D3 --> E[/prove]
        D4 --> E
    end

    subgraph Renewal [Proof Renewal -- /prove]
        E --> E1[BTC addresses pre-filled\nUpdate if needed]
        E1 --> E2[Upload fresh liability CSV]
        E2 --> E3[Run ZK circuit]
        E3 --> E4[Sign and submit\nsubmit_proof call]
        E4 --> D
    end

    style Onboarding fill:#0a0a0a,stroke:#2a2a2a,color:#e5e5e5
    style Dashboard fill:#0a0a0a,stroke:#2a2a2a,color:#e5e5e5
    style Renewal fill:#0a0a0a,stroke:#2a2a2a,color:#e5e5e5
```

---

## Public Verifier Flow

```mermaid
flowchart TD
    A([Visit Starkproof]) --> B[/registry\nPublic Solvency Registry]

    B --> C{Entity status}
    C -->|Active| D[Green badge\nValid proof on-chain]
    C -->|Expiring| E[Yellow badge\nProof expires soon]
    C -->|Expired| F[Red badge\nProof lapsed]

    B --> G[Click entity row]
    G --> H[/entity/id\nEntity Public Profile]

    H --> H1[View proof history\ntimeline]
    H --> H2[View reserve band\ntrend over time]
    H --> H3[See last attested\nBTC block height]
    H --> H4[Merkle root\nfor each proof period]

    H --> I{Want to verify\nyour balance?}
    I -->|Yes| J[Enter your account_id\nand balance amount]
    J --> K[Paste Merkle branches\nfrom the exchange]
    K --> L[Browser computes\nPoseidon path to root]
    L --> M{Root matches\non-chain root?}
    M -->|Yes| N[Confirmed: Your balance\nwas included in the audit]
    M -->|No| O[Not found: Contact\nthe exchange]

    B --> P[/verify\nAuditor Tool]
    P --> P1[Paste proof commitment\nand public inputs]
    P1 --> P2[Independent verification\nno trust in Starkproof UI]
    P2 --> P3{Valid?}
    P3 -->|Yes| P4[Proof verified]
    P3 -->|No| P5[Proof invalid or tampered]

    style B fill:#0a0a0a,stroke:#2a2a2a,color:#e5e5e5
    style H fill:#0a0a0a,stroke:#2a2a2a,color:#e5e5e5
```

---

## Navigation Structure

```mermaid
graph LR
    NAV[Navigation Bar]

    NAV --> PUB[Public\nno wallet needed]
    NAV --> OP[Operator\nwallet connected]

    PUB --> R[/registry]
    PUB --> V[/verify]

    OP --> OB[/onboard\nif new]
    OP --> DB[/dashboard\nif registered]
    OP --> PR[/prove\nrenewal]

    R --> EID[/entity/id]
    DB --> PR

    style NAV fill:#1a1a1a,stroke:#333,color:#fff
    style PUB fill:#0a0a0a,stroke:#2a2a2a,color:#aaa
    style OP fill:#0a0a0a,stroke:#2a2a2a,color:#aaa
```
