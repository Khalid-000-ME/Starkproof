/// Starkproof Circuit — Main Cairo Program
///
/// This is the Cairo program that proves solvency without revealing private data.
/// It runs off-chain (on the prover's machine) and outputs public commitments
/// that can be verified on-chain by the ReservesRegistry.
///
/// Public outputs (what goes on-chain):
///   - liability_merkle_root: felt252  -- commitment to liability set
///   - reserve_ratio_band: u8          -- 1=100-110%, 2=110-120%, 3=≥120%
///
/// Private inputs (never leave the prover's machine):
///   - wallet_balances: Array<u64>     -- satoshi amounts per wallet
///   - liability_amounts: Array<u64>   -- per-customer liability in satoshis
///   - account_id_hashes: Array<felt252> -- hashed account identifiers

pub mod merkle;
pub mod constraints;
pub mod band;
pub mod main;
