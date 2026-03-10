// Client-side Merkle tree using the same Poseidon hash algorithm as the Cairo circuit.
// This lets the frontend compute a preliminary liability root before generating the proof.

import { hash } from "starknet";

export function poseidonHashMany(values: bigint[]): bigint {
    return BigInt(hash.computePoseidonHashOnElements(values.map(v => "0x" + v.toString(16))));
}

/**
 * Compute a leaf hash from (account_id_hash, liability_satoshi).
 * Mirrors: leaf_hash in circuit/src/merkle.cairo
 */
export function leafHash(accountIdHash: bigint, liabilitySatoshi: bigint): bigint {
    return poseidonHashMany([accountIdHash, liabilitySatoshi]);
}

/**
 * Compute Merkle root from an array of leaf values.
 * Uses Poseidon hash for internal nodes.
 * Mirrors: compute_merkle_root in circuit/src/merkle.cairo
 */
export function computeMerkleRoot(leaves: bigint[]): bigint {
    if (leaves.length === 0) throw new Error("Empty leaves array");
    if (leaves.length === 1) return leaves[0];

    let currentLevel = [...leaves];

    while (currentLevel.length > 1) {
        const nextLevel: bigint[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
            nextLevel.push(poseidonHashMany([left, right]));
        }
        currentLevel = nextLevel;
    }

    return currentLevel[0];
}

export function computeMerkleBranch(leaves: bigint[], targetIndex: number): Array<{ side: "left" | "right", hash: string }> {
    if (leaves.length === 0 || targetIndex < 0 || targetIndex >= leaves.length) throw new Error("Invalid target index");
    
    let currentLevel = [...leaves];
    let currentIndex = targetIndex;
    const branch: Array<{ side: "left" | "right", hash: string }> = [];

    while (currentLevel.length > 1) {
        const nextLevel: bigint[] = [];
        let nextIndex = 0;
        
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
            
            if (i === currentIndex || i + 1 === currentIndex) {
                if (i === currentIndex) {
                    branch.push({ side: "right", hash: "0x" + right.toString(16) });
                } else {
                    branch.push({ side: "left", hash: "0x" + left.toString(16) });
                }
                nextIndex = nextLevel.length;
            }
            
            nextLevel.push(poseidonHashMany([left, right]));
        }
        
        currentLevel = nextLevel;
        currentIndex = nextIndex;
    }

    return branch;
}

/**
 * Parse a CSV string with columns: account_id_hash,liability_satoshi
 * Returns the Merkle root and leaf count.
 */
export function computeLiabilityRoot(csvData: string): {
    root: bigint;
    leafCount: number;
    totalLiability: bigint;
    leaves: Array<{ id: string; amount: bigint }>;
    leafHashes: bigint[];
} {
    const lines = csvData
        .trim()
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("#"));

    // Skip header row if present
    const dataLines = lines[0]?.toLowerCase().includes("account")
        ? lines.slice(1)
        : lines;

    if (dataLines.length === 0) {
        throw new Error("No data rows found in CSV");
    }

    const leaves: Array<{ id: string; amount: bigint }> = [];
    let totalLiability = 0n;

    for (const line of dataLines) {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length < 2) continue;

        const [idStr, amountStr] = parts;
        const amount = BigInt(amountStr.replace(/[^0-9]/g, ""));
        leaves.push({ id: idStr, amount });
        totalLiability += amount;
    }

    if (leaves.length === 0) {
        throw new Error("No valid rows parsed from CSV");
    }

    const leafHashes = leaves.map(({ id, amount }) => {
        // Convert id string to felt252
        let idFelt = 0n;
        for (const char of id) {
            idFelt = (idFelt << 8n) | BigInt(char.charCodeAt(0));
        }
        // Mask to felt252 range
        idFelt = idFelt % (2n ** 251n);
        return leafHash(idFelt, amount);
    });

    const root = computeMerkleRoot(leafHashes);

    return {
        root,
        leafCount: leaves.length,
        totalLiability,
        leaves,
        leafHashes
    };
}

/**
 * Compute a proof commitment from the public inputs.
 * This is the value submitted to the ReservesRegistry as proof_commitment.
 */
export function computeProofCommitment(
    entityId: bigint,
    blockHeight: bigint,
    liabilityRoot: bigint,
    band: number,
    timestamp: bigint
): bigint {
    return poseidonHashMany([
        entityId,
        blockHeight,
        liabilityRoot,
        BigInt(band),
        timestamp,
    ]);
}

/**
 * Compute entity ID from name_hash and registrant address.
 * Mirrors the Cairo contract: poseidon_hash_span([name_hash, caller_felt])
 */
export function computeEntityId(nameHash: bigint, registrantAddress: bigint): bigint {
    return poseidonHashMany([nameHash, registrantAddress]);
}

/**
 * Convert a string to a felt252 (same approach as Cairo stringToFelt).
 */
export function stringToFelt252(str: string): bigint {
    let result = 0n;
    for (const char of str) {
        result = (result << 8n) | BigInt(char.charCodeAt(0));
    }
    return result % (2n ** 251n);
}

export function computeReserveBand(
    totalReserves: bigint,
    totalLiabilities: bigint
): number {
    if (totalReserves < totalLiabilities) return 0; // Insolvent
    const ratioPct = (totalReserves * 100n) / totalLiabilities;
    if (ratioPct < 110n) return 1;
    if (ratioPct < 120n) return 2;
    return 3;
}
