import { NextResponse } from "next/server";

export async function GET() {
    try {
        const target = (process.env.PROVER_API_URL || "http://localhost:8080") + "/health";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(target, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            return NextResponse.json({ status: "up" });
        }
        return NextResponse.json({ status: "down" }, { status: 503 });
    } catch (e) {
        return NextResponse.json({ status: "down" }, { status: 503 });
    }
}
