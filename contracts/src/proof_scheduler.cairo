/// Starkproof — ProofScheduler Contract
///
/// Tracks all registered entities from the ReservesRegistry and provides:
/// - Ecosystem-wide health metrics (valid/expired/never-proven counts)
/// - List of entities whose proofs are expiring soon (< 7 days)
///
/// The scheduler reads state from the ReservesRegistry via interface calls.

use starknet::ContractAddress;

// Import the registry interface types
use super::reserves_registry::{
    IReservesRegistryDispatcher, IReservesRegistryDispatcherTrait, ProofStatus,
};

const EXPIRY_WARNING_WINDOW: u64 = 604800_u64; // 7 days in seconds

#[derive(Drop, Serde, Copy)]
pub struct EcosystemHealth {
    pub total_entities: u32,
    pub valid_proofs: u32,
    pub expired_proofs: u32,
    pub never_proven: u32,
    pub last_updated: u64,
}

#[starknet::interface]
pub trait IProofScheduler<TContractState> {
    /// Returns entities whose proof expires within 7 days.
    fn get_expiring_soon(self: @TContractState) -> Array<felt252>;

    /// Returns current ecosystem health metrics.
    fn get_ecosystem_health(self: @TContractState) -> EcosystemHealth;

    /// Returns the address of the linked registry.
    fn get_registry(self: @TContractState) -> ContractAddress;

    /// Returns the expiry warning window in seconds.
    fn get_warning_window(self: @TContractState) -> u64;
}

#[starknet::contract]
pub mod ProofScheduler {
    use super::{
        EcosystemHealth, IProofScheduler, EXPIRY_WARNING_WINDOW,
        IReservesRegistryDispatcher, IReservesRegistryDispatcherTrait, ProofStatus,
    };
    use starknet::{ContractAddress, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        registry: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, registry_address: ContractAddress) {
        self.registry.write(registry_address);
    }

    #[abi(embed_v0)]
    impl ProofSchedulerImpl of IProofScheduler<ContractState> {
        fn get_expiring_soon(self: @ContractState) -> Array<felt252> {
            let registry = IReservesRegistryDispatcher {
                contract_address: self.registry.read(),
            };
            let now = get_block_timestamp();
            let warning_cutoff = now + EXPIRY_WARNING_WINDOW;

            let total = registry.get_entity_count();
            let mut expiring: Array<felt252> = ArrayTrait::new();
            let mut i: u32 = 0;

            loop {
                if i >= total {
                    break;
                }
                let entity_id = registry.get_entity_id_at(i);
                let status = registry.get_status(entity_id);
                match status {
                    ProofStatus::Active => {
                        let record = registry.get_proof_record(entity_id);
                        // Expiring if expiry is within 7 days from now
                        if record.expiry_timestamp <= warning_cutoff
                            && record.expiry_timestamp > now {
                            expiring.append(entity_id);
                        }
                    },
                    _ => {},
                }
                i += 1_u32;
            };

            expiring
        }

        fn get_ecosystem_health(self: @ContractState) -> EcosystemHealth {
            let registry = IReservesRegistryDispatcher {
                contract_address: self.registry.read(),
            };
            let now = get_block_timestamp();
            let total = registry.get_entity_count();

            let mut valid: u32 = 0;
            let mut expired: u32 = 0;
            let mut never: u32 = 0;
            let mut i: u32 = 0;

            loop {
                if i >= total {
                    break;
                }
                let entity_id = registry.get_entity_id_at(i);
                let status = registry.get_status(entity_id);
                match status {
                    ProofStatus::Active => { valid += 1_u32; },
                    ProofStatus::Expired => { expired += 1_u32; },
                    ProofStatus::NeverProven => { never += 1_u32; },
                }
                i += 1_u32;
            };

            EcosystemHealth {
                total_entities: total,
                valid_proofs: valid,
                expired_proofs: expired,
                never_proven: never,
                last_updated: now,
            }
        }

        fn get_registry(self: @ContractState) -> ContractAddress {
            self.registry.read()
        }

        fn get_warning_window(self: @ContractState) -> u64 {
            EXPIRY_WARNING_WINDOW
        }
    }
}
