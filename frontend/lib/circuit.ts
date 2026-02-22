// Cairo circuit wrapper
// This module handles the off-chain proof generation flow.
// In production, this would call cairo-prove subprocess.
// For the hackathon/demo, it simulates proof generation with real computation.

import { computeLiabilityRoot, computeReserveBand, computeProofCommitment, stringToFelt252 } from "./merkle";

export interface ProofGenerationInput {
    entityId: string;
    walletAddresses: string[];
    walletBalances: number[]; // satoshi
    liabilitiesCSV: string;
    btcBlockHeight: number;
}

export interface ProofOutput {
    proofCommitment: string; // feltHex
    publicInputs: {
        entityId: string;
        blockHeight: number;
        liabilityMerkleRoot: string;
        reserveRatioBand: number;
        proofTimestamp: number;
    };
    generationTimeMs: number;
    liabilityCount: number;
    totalReservesBTC: number;
    totalLiabilitiesBTC: number;
    estimatedRatioPct: number;
    starkProofBytecode?: string;
    executionId?: string;
}

export interface ProofGenerationProgress {
    step: string;
    status: "pending" | "running" | "done" | "error";
    detail?: string;
}

/**
 * Generate a solvency proof.
 *
 * This runs the circuit logic locally:
 * 1. Parse liability CSV and compute Merkle root
 * 2. Sum wallet balances
 * 3. Assert solvency (throw if insolvent → no proof possible)
 * 4. Compute reserve ratio band
 * 5. Compute proof commitment (poseidon hash of public inputs)
 *
 * In a production system, step 5 would be replaced by:
 *   const proof = await execFile("cairo-prove", [...args])
 */
export async function generateProof(
    input: ProofGenerationInput,
    onProgress?: (progress: ProofGenerationProgress[]) => void
): Promise<ProofOutput> {
    const startTime = Date.now();

    const progress: ProofGenerationProgress[] = [
        { step: "Fetching Bitcoin balances from RPC", status: "done" },
        { step: "Parsing liability CSV", status: "running" },
        { step: "Building liability Merkle tree", status: "pending" },
        { step: "Running solvency assertion", status: "pending" },
        { step: "Computing reserve ratio band", status: "pending" },
        { step: "Generating proof commitment", status: "pending" },
    ];

    const updateProgress = (idx: number, status: ProofGenerationProgress["status"], detail?: string) => {
        progress[idx] = { ...progress[idx], status, detail };
        if (idx + 1 < progress.length && status === "done") {
            progress[idx + 1] = { ...progress[idx + 1], status: "running" };
        }
        onProgress?.([...progress]);
    };

    // Step 1: Parse CSV and build Merkle root
    await delay(300);
    updateProgress(1, "done");

    let merkleResult;
    try {
        merkleResult = computeLiabilityRoot(input.liabilitiesCSV);
    } catch (err) {
        updateProgress(2, "error", String(err));
        throw new Error(`Failed to parse liabilities: ${err}`);
    }

    await delay(500);
    updateProgress(2, "done");

    // Step 2: Sum wallet balances
    const totalReservesSatoshi = input.walletBalances.reduce((a, b) => a + b, 0);
    const totalReservesBigInt = BigInt(totalReservesSatoshi);
    const totalLiabilitiesBigInt = merkleResult.totalLiability;

    await delay(200);
    updateProgress(3, "running");

    // Step 3: Assert solvency
    if (totalReservesBigInt < totalLiabilitiesBigInt) {
        updateProgress(3, "error", "Reserves < Liabilities: INSOLVENT");
        throw new Error(
            "CIRCUIT FAILED: total_reserves < total_liabilities. " +
            "The mathematics cannot produce a proof for an insolvent entity. " +
            `Reserves: ${totalReservesSatoshi} sat, Liabilities: ${totalLiabilitiesBigInt.toString()} sat`
        );
    }

    await delay(300);
    updateProgress(3, "done");

    // Step 4: Compute band
    const band = computeReserveBand(totalReservesBigInt, totalLiabilitiesBigInt);

    await delay(200);
    updateProgress(4, "done");

    // Step 5: Generate proof commitment
    const entityIdBigInt = BigInt(input.entityId);
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const commitment = computeProofCommitment(
        entityIdBigInt,
        BigInt(input.btcBlockHeight),
        merkleResult.root,
        band,
        timestamp
    );

    // Call True ZK Prover API
    let trueZkPayload;
    try {
        const response = await fetch("/api/prove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                entityId: input.entityId,
                walletBalances: input.walletBalances,
                liabilitiesCSV: input.liabilitiesCSV,
                btcBlockHeight: input.btcBlockHeight
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Prover API responded with ${response.status}: ${errBody}`);
        }

        trueZkPayload = await response.json();
    } catch (err) {
        updateProgress(5, "error", String(err));
        throw new Error(`Failed to contact True ZK Prover API: ${err}`);
    }

    updateProgress(5, "done");

    const generationTimeMs = Date.now() - startTime;
    const ratioPct =
        totalLiabilitiesBigInt > 0n
            ? Number((totalReservesBigInt * 10000n) / totalLiabilitiesBigInt) / 100
            : 999;

    return {
        proofCommitment: "0x" + commitment.toString(16),
        publicInputs: {
            entityId: input.entityId,
            blockHeight: input.btcBlockHeight,
            liabilityMerkleRoot: "0x" + merkleResult.root.toString(16),
            reserveRatioBand: band,
            proofTimestamp: Number(timestamp),
        },
        generationTimeMs,
        liabilityCount: merkleResult.leafCount,
        totalReservesBTC: totalReservesSatoshi / 1e8,
        totalLiabilitiesBTC: Number(totalLiabilitiesBigInt) / 1e8,
        estimatedRatioPct: ratioPct,
        starkProofBytecode: trueZkPayload?.proofData?.starkProofBytecode,
        executionId: trueZkPayload?.proofData?.executionId
    };
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function execFile(_cmd: string, _args: string[]): Promise<{ stdout: string }> {
    // Production: spawn cairo-prove process
    throw new Error("cairo-prove subprocess not available in this environment");
}
