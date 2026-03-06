import { NextResponse } from "next/server";

export async function GET() {
    try {
        let proverUrl = process.env.PROVER_API_URL || "http://127.0.0.1:8080";
        try {
            const { cookies } = require('next/headers');
            const cookieStore = await cookies();
            const stored = cookieStore.get('prover_url')?.value;
            if (stored) proverUrl = stored;
        } catch (e) {
            // Ignore cookie errors
        }
        const baseUrl = proverUrl.endsWith('/') ? proverUrl.slice(0, -1) : proverUrl;
        const target = `${baseUrl}/health`;
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
