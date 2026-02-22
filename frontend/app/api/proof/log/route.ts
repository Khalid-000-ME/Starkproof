import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// In a real environment, you'd insert this into a PostgreSQL database mapped to the txHash.
// For hackathon/demo purposes, we append to a local log file, and print clearly to the server console.

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Server Console Output
        console.log("\n" + "=".repeat(60));
        console.log("  🛡️  NEW PROOF COMMITMENT GENERATED  🛡️");
        console.log("=".repeat(60));
        console.log("For Auditor Verification. Copy these values:");
        console.log(`\n  Entity ID:              ${body.publicInputs.entityId}`);
        console.log(`  Proof Commitment:       ${body.proofCommitment}`);
        console.log(`  Liability Merkle Root:  ${body.publicInputs.liabilityMerkleRoot}`);
        console.log(`  BTC Block Height:       ${body.publicInputs.blockHeight}`);
        console.log(`  Reserve Ratio Band:     Band ${body.publicInputs.reserveRatioBand}`);
        console.log(`  Proof Timestamp:        ${body.publicInputs.proofTimestamp}`);
        console.log("\nIf you submitted an on-chain transaction, the hash will appear in your wallet.");
        console.log("=".repeat(60) + "\n");

        return NextResponse.json({ success: true, logged: true });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
