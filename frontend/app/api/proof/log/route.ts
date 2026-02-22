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

        // Write to local JSON log for persistence (so auditor can fetch it if we needed to build an endpoint for it)
        const logFilePath = path.join(process.cwd(), "proof_logs.json");
        let logs: any[] = [];
        try {
            if (fs.existsSync(logFilePath)) {
                logs = JSON.parse(fs.readFileSync(logFilePath, "utf8"));
            }
        } catch (e) { }

        const logEntry = {
            timestamp_logged: new Date().toISOString(),
            ...body
        };
        // Remove the massive bytecode from the local log array to avoid memory bloat
        if (logEntry.starkProofBytecode) delete logEntry.starkProofBytecode;

        logs.push(logEntry);

        fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));

        return NextResponse.json({ success: true, logged: true });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
