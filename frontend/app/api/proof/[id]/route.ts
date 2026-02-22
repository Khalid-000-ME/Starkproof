import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const idParam = id.toLowerCase();
        // since proof_logs.json is removed for privacy, just pull the latest stark proof from local fs
        // normally an entity would expose this via their own static site
        const executionsDir = path.join(process.cwd(), "..", "circuit", "target", "execute", "zkreserves_circuit");
        if (!fs.existsSync(executionsDir)) {
            return NextResponse.json({ error: "No proofs generated yet." }, { status: 404 });
        }

        const dirs = fs.readdirSync(executionsDir).filter(d => d.startsWith("execution"));
        if (dirs.length === 0) {
            return NextResponse.json({ error: "Proof JSON not found." }, { status: 404 });
        }

        // Sort by modified time descending
        dirs.sort((a, b) => {
            return fs.statSync(path.join(executionsDir, b)).mtimeMs - fs.statSync(path.join(executionsDir, a)).mtimeMs;
        });

        const latestDir = dirs[0];
        const proofPath = path.join(executionsDir, latestDir, "proof", "proof.json");

        if (!fs.existsSync(proofPath)) {
            return NextResponse.json({ error: "Proof file not found on disk." }, { status: 404 });
        }

        const bytecode = fs.readFileSync(proofPath, "utf8");

        return NextResponse.json({
            success: true,
            starkProofBytecode: bytecode
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
