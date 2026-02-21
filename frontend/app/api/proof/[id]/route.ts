import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const idParam = params.id.toLowerCase();
        const logFilePath = path.join(process.cwd(), "proof_logs.json");

        if (!fs.existsSync(logFilePath)) {
            return NextResponse.json({ error: "No proofs generated yet." }, { status: 404 });
        }

        const logs = JSON.parse(fs.readFileSync(logFilePath, "utf8"));

        // Find the most recent log matching the entityId
        const entityLogs = logs.filter((l: any) => l.publicInputs?.entityId?.toLowerCase() === idParam);
        if (entityLogs.length === 0) {
            return NextResponse.json({ error: "Proof JSON not found for this entity." }, { status: 404 });
        }

        const latestProof = entityLogs[entityLogs.length - 1];

        return NextResponse.json({
            success: true,
            starkProofBytecode: latestProof.starkProofBytecode
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
