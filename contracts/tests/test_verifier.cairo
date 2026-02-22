use starkproof_circuit::merkle::{leaf_hash, compute_merkle_root, build_liability_root};
use starkproof_circuit::constraints::{sum_u64_array, assert_solvent, assert_valid_inputs};
use starkproof_circuit::band::{compute_band, band_label};

// ─── Merkle Tests ─────────────────────────────────────────────────────────────

#[test]
fn test_leaf_hash_deterministic() {
    let h1 = leaf_hash(0xabc, 1000_u64);
    let h2 = leaf_hash(0xabc, 1000_u64);
    assert(h1 == h2, 'Leaf hash should be deterministic');
}

#[test]
fn test_leaf_hash_different_inputs() {
    let h1 = leaf_hash(0xabc, 1000_u64);
    let h2 = leaf_hash(0xabc, 2000_u64);
    assert(h1 != h2, 'Different inputs should give different hashes');
}

#[test]
fn test_merkle_single_leaf() {
    let leaves = array![0xdeadbeef_felt252];
    let root = compute_merkle_root(leaves);
    assert(root == 0xdeadbeef, 'Single leaf root should be itself');
}

#[test]
fn test_merkle_two_leaves() {
    let leaves = array![0x1111_felt252, 0x2222_felt252];
    let root = compute_merkle_root(leaves);
    assert(root != 0, 'Root should not be zero');
}

#[test]
fn test_merkle_root_deterministic() {
    let leaves1 = array![0x1_felt252, 0x2_felt252, 0x3_felt252];
    let leaves2 = array![0x1_felt252, 0x2_felt252, 0x3_felt252];
    let root1 = compute_merkle_root(leaves1);
    let root2 = compute_merkle_root(leaves2);
    assert(root1 == root2, 'Same input should give same root');
}

#[test]
fn test_build_liability_root() {
    let account_ids = array![0xabc_felt252, 0xdef_felt252];
    let liabilities = array![50000_u64, 30000_u64];
    let root = build_liability_root(@account_ids, @liabilities);
    assert(root != 0, 'Root should not be zero');
}

// ─── Constraints Tests ────────────────────────────────────────────────────────

#[test]
fn test_sum_u64_array() {
    let arr = array![100_u64, 200_u64, 300_u64];
    let total = sum_u64_array(@arr);
    assert(total == 600_u64, 'Sum should be 600');
}

#[test]
fn test_sum_single_element() {
    let arr = array![999_u64];
    let total = sum_u64_array(@arr);
    assert(total == 999_u64, 'Sum single should be 999');
}

#[test]
fn test_assert_solvent_passes() {
    assert_solvent(1000_u64, 900_u64); // Should not panic
}

#[test]
fn test_assert_solvent_equal() {
    assert_solvent(1000_u64, 1000_u64); // Equal is solvent (100%)
}

#[test]
#[should_panic(expected: ('Insolvent: reserves < liab',))]
fn test_assert_solvent_fails() {
    assert_solvent(900_u64, 1000_u64); // Should panic
}

// ─── Band Tests ───────────────────────────────────────────────────────────────

#[test]
fn test_band_at_100_pct() {
    // 100% exactly => band 1
    let band = compute_band(1000_u64, 1000_u64);
    assert(band == 1_u8, 'Band at 100% should be 1');
}

#[test]
fn test_band_at_105_pct() {
    // 105% => band 1
    let band = compute_band(1050_u64, 1000_u64);
    assert(band == 1_u8, 'Band at 105% should be 1');
}

#[test]
fn test_band_at_110_pct() {
    // 110% exactly => band 2 (110 < 120 returns 2)
    let band = compute_band(1100_u64, 1000_u64);
    assert(band == 2_u8, 'Band at 110% should be 2');
}

#[test]
fn test_band_at_115_pct() {
    // 115% => band 2
    let band = compute_band(1150_u64, 1000_u64);
    assert(band == 2_u8, 'Band at 115% should be 2');
}

#[test]
fn test_band_at_120_pct() {
    // 120% exactly => band 3
    let band = compute_band(1200_u64, 1000_u64);
    assert(band == 3_u8, 'Band at 120% should be 3');
}

#[test]
fn test_band_at_200_pct() {
    // 200% => band 3
    let band = compute_band(2000_u64, 1000_u64);
    assert(band == 3_u8, 'Band at 200% should be 3');
}

#[test]
fn test_band_label() {
    assert(band_label(1_u8) == '100-110%', 'Band 1 label wrong');
    assert(band_label(2_u8) == '110-120%', 'Band 2 label wrong');
    assert(band_label(3_u8) == '>=120%', 'Band 3 label wrong');
}
