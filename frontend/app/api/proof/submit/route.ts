import { NextRequest, NextResponse } from "next/server";

// This route handles Starknet proof submission.
// In production: receives a signed tx from the frontend wallet and broadcasts it.
// For demo: accepts proof data and returns a mock tx hash.

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            entity_id,
            proof,
            public_inputs,
            starknet_account_address,
        } = body;

        if (!entity_id || !proof || !public_inputs) {
            return NextResponse.json(
                { error: "Missing: entity_id, proof, public_inputs" },
                { status: 400 }
            );
        }

        // Validate public_inputs structure
        const { block_height, liability_merkle_root, reserve_ratio_band, proof_timestamp } =
            public_inputs;

        if (!block_height || !liability_merkle_root || !reserve_ratio_band || !proof_timestamp) {
            return NextResponse.json(
                { error: "Invalid public_inputs structure" },
                { status: 400 }
            );
        }

        if (reserve_ratio_band < 1 || reserve_ratio_band > 3) {
            return NextResponse.json(
                { error: "reserve_ratio_band must be 1, 2, or 3 (insolvent entities cannot prove)" },
                { status: 422 }
            );
        }

        // In production: broadcast the tx to Starknet
        // const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL! });
        // const txHash = await provider.sendRawTransaction(signed_tx);

        // Demo: return a plausible mock tx hash
        const mockTxHash =
            "0x" +
            Array.from({ length: 64 }, () =>
                Math.floor(Math.random() * 16).toString(16)
            ).join("");

        return NextResponse.json({
            success: true,
            transaction_hash: mockTxHash,
            starkscan_url: `https://sepolia.starkscan.co/tx/${mockTxHash}`,
            entity_id,
            reserve_ratio_band,
            message:
                "Proof accepted. Entity is now publicly verified on Starkproof.",
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || String(err) },
            { status: 500 }
        );
    }
}
