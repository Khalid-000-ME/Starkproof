import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        let proverUrl = process.env.PROVER_API_URL || "http://127.0.0.1:8080";
        try {
            const { cookies } = require('next/headers');
            const cookieStore = await cookies();
            const stored = cookieStore.get('prover_url')?.value;
            if (stored) proverUrl = stored;
        } catch (e) {
            // Ignore cookie errors, fallback to default
        }
        const baseUrl = proverUrl.endsWith('/') ? proverUrl.slice(0, -1) : proverUrl;
        // Pass request natively through to the Express Prover API backend
        const response = await fetch(`${baseUrl}/api/verify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errBody = await response.text();
            return NextResponse.json({ error: `Verifier API failed: ${errBody}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("Next.js API route error contacting prover:", err);
        return NextResponse.json({ error: err.message || "Failed to contact verifier API" }, { status: 500 });
    }
}
