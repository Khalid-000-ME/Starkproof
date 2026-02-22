use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};
use starknet::{ContractAddress, get_block_timestamp};
use starkproof_contracts::reserves_registry::{
    IReservesRegistryDispatcher, IReservesRegistryDispatcherTrait, PublicInputs, ProofStatus,
};

fn deploy_registry() -> IReservesRegistryDispatcher {
    let contract = declare("ReservesRegistry").unwrap().contract_class();
    let owner: ContractAddress =
        0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef_felt252
        .try_into()
        .unwrap();
    let mut calldata: Array<felt252> = ArrayTrait::new();
    calldata.append(owner.into());
    let (address, _) = contract.deploy(@calldata).unwrap();
    IReservesRegistryDispatcher { contract_address: address }
}

#[test]
fn test_register_entity() {
    let registry = deploy_registry();
    let name_hash: felt252 = 0xaabbcc;
    let entity_id = registry.register_entity(name_hash);
    assert(entity_id != 0, 'entity_id should not be zero');
    assert(registry.is_registered(entity_id), 'Entity should be registered');
    assert(registry.get_entity_count() == 1, 'Should have 1 entity');
}

#[test]
fn test_register_entity_idempotent() {
    let registry = deploy_registry();
    let name_hash: felt252 = 0xdeadbeef;
    let id1 = registry.register_entity(name_hash);
    let id2 = registry.register_entity(name_hash);
    assert(id1 == id2, 'Re-registering should return same id');
    assert(registry.get_entity_count() == 1, 'Should still have 1 entity');
}

#[test]
fn test_submit_proof_success() {
    let registry = deploy_registry();
    let name_hash: felt252 = 0xcafe;
    let entity_id = registry.register_entity(name_hash);

    let inputs = PublicInputs {
        entity_id,
        block_height: 880000_u64,
        liability_merkle_root: 0xdeadbeef1234_felt252,
        reserve_ratio_band: 3_u8,
        proof_timestamp: 1740000000_u64,
    };
    let commitment: felt252 = 0xabcdef123456;

    registry.submit_proof(entity_id, inputs, commitment);

    let record = registry.get_proof_record(entity_id);
    assert(record.reserve_ratio_band == 3_u8, 'Band should be 3');
    assert(record.is_valid, 'Record should be valid');
    assert(record.submission_count == 1_u32, 'Should be first submission');
}

#[test]
#[should_panic(expected: ('Insolvent: Band 0 not allowed',))]
fn test_submit_proof_band_zero_fails() {
    let registry = deploy_registry();
    let entity_id = registry.register_entity(0x1111);

    let inputs = PublicInputs {
        entity_id,
        block_height: 880000_u64,
        liability_merkle_root: 0xaabbcc,
        reserve_ratio_band: 0_u8, // INVALID - insolvent
        proof_timestamp: 1740000000_u64,
    };
    registry.submit_proof(entity_id, inputs, 0xdead);
}

#[test]
#[should_panic]
fn test_submit_proof_unregistered_fails() {
    let registry = deploy_registry();
    let fake_entity_id: felt252 = 0xdeadbeef;
    let inputs = PublicInputs {
        entity_id: fake_entity_id,
        block_height: 880000_u64,
        liability_merkle_root: 0xaabbcc,
        reserve_ratio_band: 3_u8,
        proof_timestamp: 1740000000_u64,
    };
    registry.submit_proof(fake_entity_id, inputs, 0xdead);
}

#[test]
fn test_get_status_never_proven() {
    let registry = deploy_registry();
    let entity_id = registry.register_entity(0xffff);
    let status = registry.get_status(entity_id);
    assert(status == ProofStatus::NeverProven, 'Status should be NeverProven');
}

#[test]
fn test_multiple_submissions() {
    let registry = deploy_registry();
    let entity_id = registry.register_entity(0x9999);

    let inputs1 = PublicInputs {
        entity_id,
        block_height: 880000_u64,
        liability_merkle_root: 0x1111,
        reserve_ratio_band: 2_u8,
        proof_timestamp: 1740000000_u64,
    };
    registry.submit_proof(entity_id, inputs1, 0xaaaa);

    let inputs2 = PublicInputs {
        entity_id,
        block_height: 881000_u64,
        liability_merkle_root: 0x2222,
        reserve_ratio_band: 3_u8,
        proof_timestamp: 1741000000_u64,
    };
    registry.submit_proof(entity_id, inputs2, 0xbbbb);

    let record = registry.get_proof_record(entity_id);
    assert(record.submission_count == 2_u32, 'Should have 2 submissions');
    assert(record.block_height == 881000_u64, 'Should have latest block');
    assert(registry.get_total_submissions() == 2_u32, 'Total should be 2');
}
