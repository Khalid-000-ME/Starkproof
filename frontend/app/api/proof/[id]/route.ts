import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const idParam = id.toLowerCase();
        const logFilePath = path.join(process.cwd(), "proof_logs.json");

        if (!fs.existsSync(logFilePath)) {
            return NextResponse.json({ error: "No proofs generated yet." }, { status: 404 });
        }

        const logs = JSON.parse(fs.readFileSync(logFilePath, "utf8"));

        // Find the most recent log matching the entityId
        let normalizedParam = idParam;
        try {
            normalizedParam = "0x" + BigInt(idParam).toString(16);
        } catch (e) { }

        const entityLogs = logs.filter((l: any) => {
            if (!l.publicInputs?.entityId) return false;
            try {
                const normLog = "0x" + BigInt(l.publicInputs.entityId).toString(16);
                return normLog === normalizedParam;
            } catch (e) {
                return l.publicInputs.entityId.toLowerCase() === idParam;
            }
        });
        if (entityLogs.length === 0) {
            return NextResponse.json({ error: "Proof JSON not found for this entity." }, { status: 404 });
        }

        const latestProof = entityLogs[entityLogs.length - 1];

        let bytecode = latestProof.starkProofBytecode;
        if (!bytecode && latestProof.executionId) {
            const proofPath = path.join(process.cwd(), "..", "circuit", "target", "execute", "zkreserves_circuit", `execution${latestProof.executionId}`, "proof", "proof.json");
            if (fs.existsSync(proofPath)) {
                bytecode = fs.readFileSync(proofPath, "utf8");
            } else {
                return NextResponse.json({ error: "Proof file not found on disk." }, { status: 404 });
            }
        }

        return NextResponse.json({
            success: true,
            starkProofBytecode: bytecode
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
