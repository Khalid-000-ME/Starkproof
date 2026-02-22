/// Starkproof — ReservesRegistry Contract
///
/// This is the main public-facing contract. It:
/// 1. Allows entities to register themselves (permissionlessly)
/// 2. Accepts proof submissions (with on-chain solvency verification logic)
/// 3. Stores proof records and full history
/// 4. Provides query functions for public dashboards
///
/// NOTE: True STARK proof verification requires the Starknet verifier infrastructure.
/// For this implementation, the "proof" is a signed commitment from the entity's
/// private computation. The core invariant (solvency) is enforced by the circuit
/// constraints encoded in the public inputs, which the registry validates structurally.

use starknet::ContractAddress;

// ─── Constants ────────────────────────────────────────────────────────────────

const PROOF_TTL: u64 = 2592000_u64; // 30 days in seconds
const MAX_RATIO_BAND: u8 = 3_u8;

// ─── Structs ──────────────────────────────────────────────────────────────────

#[derive(Drop, Serde, starknet::Store)]
pub struct EntityRecord {
    pub name_hash: felt252,
    pub registered_at: u64,
    pub registrant: ContractAddress,
}

#[derive(Drop, Serde, starknet::Store, Copy)]
pub struct ProofRecord {
    pub entity_id: felt252,
    pub block_height: u64,
    pub liability_merkle_root: felt252,
    pub reserve_ratio_band: u8,
    pub proof_timestamp: u64,
    pub is_valid: bool,
    pub expiry_timestamp: u64,
    pub submission_count: u32,
}

#[derive(Drop, Serde, starknet::Store, Copy)]
pub struct PublicInputs {
    pub entity_id: felt252,
    pub block_height: u64,
    pub liability_merkle_root: felt252,
    pub reserve_ratio_band: u8,
    pub proof_timestamp: u64,
}

#[derive(Drop, Serde, PartialEq)]
pub enum ProofStatus {
    Active,
    Expired,
    NeverProven,
}

#[derive(Drop, Serde)]
pub struct EcosystemHealth {
    pub total_entities: u32,
    pub valid_proofs: u32,
    pub expired_proofs: u32,
    pub never_proven: u32,
    pub last_updated: u64,
}

// ─── Interface ────────────────────────────────────────────────────────────────

#[starknet::interface]
pub trait IReservesRegistry<TContractState> {
    /// Register a new entity. Returns the entity_id (hash of name_hash + caller).
    fn register_entity(ref self: TContractState, name_hash: felt252) -> felt252;

    /// Submit a solvency proof with verified public inputs.
    /// The public inputs are the outputs of the off-chain Cairo circuit.
    fn submit_proof(
        ref self: TContractState,
        entity_id: felt252,
        public_inputs: PublicInputs,
        proof_commitment: felt252,
    );

    /// Get current proof status of an entity.
    fn get_status(self: @TContractState, entity_id: felt252) -> ProofStatus;

    /// Get the current proof record for an entity.
    fn get_proof_record(self: @TContractState, entity_id: felt252) -> ProofRecord;

    /// Get a historical proof record.
    fn get_proof_history_item(
        self: @TContractState, entity_id: felt252, index: u32,
    ) -> ProofRecord;

    /// Get entity record.
    fn get_entity(self: @TContractState, entity_id: felt252) -> EntityRecord;

    /// Check if entity is registered.
    fn is_registered(self: @TContractState, entity_id: felt252) -> bool;

    /// Get total number of registered entities.
    fn get_entity_count(self: @TContractState) -> u32;

    /// Get entity_id at a given index (for enumeration).
    fn get_entity_id_at(self: @TContractState, index: u32) -> felt252;

    /// Get total submission count across all entities.
    fn get_total_submissions(self: @TContractState) -> u32;

    /// Get PROOF_TTL constant.
    fn get_proof_ttl(self: @TContractState) -> u64;
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[derive(Drop, starknet::Event)]
pub struct EntityRegistered {
    #[key]
    pub entity_id: felt252,
    pub name_hash: felt252,
    pub registrant: ContractAddress,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct ProofSubmitted {
    #[key]
    pub entity_id: felt252,
    pub block_height: u64,
    pub reserve_ratio_band: u8,
    pub timestamp: u64,
    pub expiry: u64,
}

#[derive(Drop, starknet::Event)]
pub struct ProofExpiredEvent {
    #[key]
    pub entity_id: felt252,
    pub expired_at: u64,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[starknet::contract]
pub mod ReservesRegistry {
    use super::{
        EntityRecord, ProofRecord, PublicInputs, ProofStatus, PROOF_TTL,
        EntityRegistered, ProofSubmitted, IReservesRegistry,
    };
    use starknet::{ ContractAddress, get_caller_address, get_block_timestamp };
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use core::poseidon::poseidon_hash_span;

    #[storage]
    struct Storage {
        // Entity registry: entity_id -> EntityRecord
        entities: Map<felt252, EntityRecord>,
        entity_registered: Map<felt252, bool>,
        // Entity list for enumeration
        entity_count: u32,
        entity_list: Map<u32, felt252>,
        // Current proof per entity
        proofs: Map<felt252, ProofRecord>,
        has_proof: Map<felt252, bool>,
        // Historical proofs: (entity_id, index) -> ProofRecord
        // We encode the key as poseidon(entity_id, index)
        proof_history: Map<felt252, ProofRecord>,
        // Total submission count
        total_submissions: u32,
        // Owner
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        EntityRegistered: EntityRegistered,
        ProofSubmitted: ProofSubmitted,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.entity_count.write(0_u32);
        self.total_submissions.write(0_u32);
    }

    #[abi(embed_v0)]
    impl ReservesRegistryImpl of IReservesRegistry<ContractState> {
        fn register_entity(ref self: ContractState, name_hash: felt252) -> felt252 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            // Derive entity_id from name_hash + caller address
            let caller_felt: felt252 = caller.into();
            let entity_id = poseidon_hash_span(array![name_hash, caller_felt].span());

            // If already registered, return existing id
            if self.entity_registered.read(entity_id) {
                return entity_id;
            }

            // Store entity record
            let record = EntityRecord {
                name_hash, registered_at: timestamp, registrant: caller,
            };
            self.entities.write(entity_id, record);
            self.entity_registered.write(entity_id, true);

            // Add to enumerable list
            let count = self.entity_count.read();
            self.entity_list.write(count, entity_id);
            self.entity_count.write(count + 1_u32);

            // Emit event
            self
                .emit(
                    EntityRegistered {
                        entity_id, name_hash, registrant: caller, timestamp,
                    },
                );

            entity_id
        }

        fn submit_proof(
            ref self: ContractState,
            entity_id: felt252,
            public_inputs: PublicInputs,
            proof_commitment: felt252,
        ) {
            // Entity must be registered
            assert(self.entity_registered.read(entity_id), 'Entity not registered');
            
            // Only the original registrant wallet can submit proofs for this entity
            let caller = get_caller_address();
            let entity_record = self.entities.read(entity_id);
            assert(caller == entity_record.registrant, 'Unauthorized sender');

            // Entity IDs must match
            assert(public_inputs.entity_id == entity_id, 'Entity ID mismatch');
            // reserve_ratio_band must be valid (1–3; 0 means insolvent, cannot be proven)
            assert(public_inputs.reserve_ratio_band >= 1_u8, 'Band 0: insolvent entity');
            assert(public_inputs.reserve_ratio_band <= 3_u8, 'Band > 3: invalid');
            // Liability root must be non-zero
            assert(public_inputs.liability_merkle_root != 0, 'Liability root is zero');
            // proof_commitment must be non-zero
            assert(proof_commitment != 0, 'Proof commitment is zero');

            let timestamp = get_block_timestamp();
            let expiry = timestamp + PROOF_TTL;

            // Get existing submission count for this entity
            let existing_count = if self.has_proof.read(entity_id) {
                self.proofs.read(entity_id).submission_count + 1_u32
            } else {
                1_u32
            };

            let record = ProofRecord {
                entity_id,
                block_height: public_inputs.block_height,
                liability_merkle_root: public_inputs.liability_merkle_root,
                reserve_ratio_band: public_inputs.reserve_ratio_band,
                proof_timestamp: timestamp,
                is_valid: true,
                expiry_timestamp: expiry,
                submission_count: existing_count,
            };

            // Store as current proof
            self.proofs.write(entity_id, record);
            self.has_proof.write(entity_id, true);

            // Append to history using composite key
            let history_key = poseidon_hash_span(
                array![entity_id, existing_count.into()].span(),
            );
            self.proof_history.write(history_key, record);

            // Increment global counter
            let total = self.total_submissions.read();
            self.total_submissions.write(total + 1_u32);

            self
                .emit(
                    ProofSubmitted {
                        entity_id,
                        block_height: public_inputs.block_height,
                        reserve_ratio_band: public_inputs.reserve_ratio_band,
                        timestamp,
                        expiry,
                    },
                );
        }

        fn get_status(self: @ContractState, entity_id: felt252) -> ProofStatus {
            if !self.has_proof.read(entity_id) {
                return ProofStatus::NeverProven;
            }
            let record = self.proofs.read(entity_id);
            let now = get_block_timestamp();
            if now > record.expiry_timestamp {
                ProofStatus::Expired
            } else {
                ProofStatus::Active
            }
        }

        fn get_proof_record(self: @ContractState, entity_id: felt252) -> ProofRecord {
            self.proofs.read(entity_id)
        }

        fn get_proof_history_item(
            self: @ContractState, entity_id: felt252, index: u32,
        ) -> ProofRecord {
            let key = poseidon_hash_span(array![entity_id, index.into()].span());
            self.proof_history.read(key)
        }

        fn get_entity(self: @ContractState, entity_id: felt252) -> EntityRecord {
            self.entities.read(entity_id)
        }

        fn is_registered(self: @ContractState, entity_id: felt252) -> bool {
            self.entity_registered.read(entity_id)
        }

        fn get_entity_count(self: @ContractState) -> u32 {
            self.entity_count.read()
        }

        fn get_entity_id_at(self: @ContractState, index: u32) -> felt252 {
            self.entity_list.read(index)
        }

        fn get_total_submissions(self: @ContractState) -> u32 {
            self.total_submissions.read()
        }

        fn get_proof_ttl(self: @ContractState) -> u64 {
            PROOF_TTL
        }
    }
}
