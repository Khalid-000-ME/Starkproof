import { NextRequest, NextResponse } from "next/server";


export const dynamic = "force-dynamic";


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const idParam = id.toLowerCase();

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

        const target = `${baseUrl}/api/proof/${idParam}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(target, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return NextResponse.json({ error: data.error || "Failed to fetch proof from prover API." }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
