/// Solvency constraints for the Starkproof circuit.
///
/// These are the core assertions that the circuit enforces.
/// If any assertion fails, no valid proof can be generated.

/// Sum an array of u64 values. Panics on overflow via felt arithmetic.
pub fn sum_u64_array(arr: @Array<u64>) -> u64 {
    let mut total: u64 = 0;
    let mut i: u32 = 0;
    let n = arr.len();
    loop {
        if i >= n {
            break;
        }
        // Overflow check: if adding would exceed u64::MAX, panic
        let val = *arr.at(i);
        assert(total <= 18446744073709551615_u64 - val, 'Sum overflow');
        total += val;
        i += 1;
    };
    total
}

/// Core solvency assertion.
///
/// Asserts: total_reserves >= total_liabilities
/// If this fails, the circuit cannot produce a valid proof.
pub fn assert_solvent(total_reserves: u64, total_liabilities: u64) {
    assert(total_reserves >= total_liabilities, 'Insolvent: reserves < liab');
}

/// Assert that both arrays exist and are non-empty.
pub fn assert_valid_inputs(
    wallet_balances: @Array<u64>,
    liability_amounts: @Array<u64>,
    account_id_hashes: @Array<felt252>,
) {
    assert(wallet_balances.len() > 0, 'No wallet balances');
    assert(liability_amounts.len() > 0, 'No liabilities');
    assert(
        liability_amounts.len() == account_id_hashes.len(), 'Length mismatch: liab/ids',
    );
}
