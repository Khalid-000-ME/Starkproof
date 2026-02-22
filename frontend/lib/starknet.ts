import { RpcProvider, Contract, type Abi } from "starknet";

export const STARKNET_RPC =
  process.env.NEXT_PUBLIC_STARKNET_RPC ||
  "https://api.cartridge.gg/x/starknet/sepolia";

export const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0x0";

export const SCHEDULER_ADDRESS =
  process.env.NEXT_PUBLIC_SCHEDULER_ADDRESS || "0x0";

export const provider = new RpcProvider({ nodeUrl: STARKNET_RPC });

// ─── ABIs ─────────────────────────────────────────────────────────────────────

export const REGISTRY_ABI: Abi = [
  {
    name: "IReservesRegistry",
    type: "interface",
    items: [
      {
        name: "register_entity",
        type: "function",
        inputs: [{ name: "name_hash", type: "core::felt252" }],
        outputs: [{ type: "core::felt252" }],
        state_mutability: "external",
      },
      {
        name: "submit_proof",
        type: "function",
        inputs: [
          { name: "entity_id", type: "core::felt252" },
          {
            name: "public_inputs",
            type: "starkproof_contracts::reserves_registry::PublicInputs",
          },
          { name: "proof_commitment", type: "core::felt252" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        name: "get_status",
        type: "function",
        inputs: [{ name: "entity_id", type: "core::felt252" }],
        outputs: [
          {
            type: "starkproof_contracts::reserves_registry::ProofStatus",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_proof_record",
        type: "function",
        inputs: [{ name: "entity_id", type: "core::felt252" }],
        outputs: [
          {
            type: "starkproof_contracts::reserves_registry::ProofRecord",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_proof_history_item",
        type: "function",
        inputs: [
          { name: "entity_id", type: "core::felt252" },
          { name: "index", type: "core::integer::u32" },
        ],
        outputs: [
          {
            type: "starkproof_contracts::reserves_registry::ProofRecord",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "get_entity",
        type: "function",
        inputs: [{ name: "entity_id", type: "core::felt252" }],
        outputs: [
          {
            type: "starkproof_contracts::reserves_registry::EntityRecord",
          },
        ],
        state_mutability: "view",
      },
      {
        name: "is_registered",
        type: "function",
        inputs: [{ name: "entity_id", type: "core::felt252" }],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
      {
        name: "get_entity_count",
        type: "function",
        inputs: [],
        outputs: [{ type: "core::integer::u32" }],
        state_mutability: "view",
      },
      {
        name: "get_entity_id_at",
        type: "function",
        inputs: [{ name: "index", type: "core::integer::u32" }],
        outputs: [{ type: "core::felt252" }],
        state_mutability: "view",
      },
      {
        name: "get_total_submissions",
        type: "function",
        inputs: [],
        outputs: [{ type: "core::integer::u32" }],
        state_mutability: "view",
      },
      {
        name: "get_proof_ttl",
        type: "function",
        inputs: [],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
    ],
  },
];

export const SCHEDULER_ABI: Abi = [
  {
    name: "IProofScheduler",
    type: "interface",
    items: [
      {
        name: "get_expiring_soon",
        type: "function",
        inputs: [],
        outputs: [
          { type: "core::array::Array::<core::felt252>" },
        ],
        state_mutability: "view",
      },
      {
        name: "get_ecosystem_health",
        type: "function",
        inputs: [],
        outputs: [
          {
            type: "starkproof_contracts::proof_scheduler::EcosystemHealth",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProofStatus = "Active" | "Expired" | "NeverProven";

export interface ProofRecord {
  entity_id: string;
  block_height: bigint;
  liability_merkle_root: string;
  reserve_ratio_band: number;
  proof_timestamp: bigint;
  is_valid: boolean;
  expiry_timestamp: bigint;
  submission_count: number;
}

export interface EntityRecord {
  name_hash: string;
  registered_at: bigint;
  registrant: string;
}

export interface PublicInputs {
  entity_id: string;
  block_height: bigint;
  liability_merkle_root: string;
  reserve_ratio_band: number;
  proof_timestamp: bigint;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

export function bandLabel(band: number): string {
  switch (band) {
    case 1: return "100–110%";
    case 2: return "110–120%";
    case 3: return "≥ 120%";
    default: return "—";
  }
}

export function bandColor(band: number): string {
  switch (band) {
    case 1: return "#F59E0B";
    case 2: return "#86EFAC";
    case 3: return "#10B981";
    default: return "#6B7280";
  }
}

export function formatTimestamp(ts: bigint | number): string {
  const date = new Date(Number(ts) * 1000);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(ts: bigint | number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(ts);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function daysUntilExpiry(expiry: bigint | number): number {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(expiry) - now;
  return Math.max(0, Math.floor(diff / 86400));
}

export function feltToHash(felt: string): string {
  const hex = BigInt(felt).toString(16).padStart(64, "0");
  return `0x${hex}`;
}

export function stringToFelt(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return "0x" + result.toString(16);
}
