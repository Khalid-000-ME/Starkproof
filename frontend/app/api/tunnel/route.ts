import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const { url } = await req.json();
        
        // Basic validation for URL
        if (url && !url.startsWith("http")) {
            return NextResponse.json({ error: "Invalid URL. It should start with http:// or https://" }, { status: 400 });
        }

        // Save serverlessly via cookie
        const cookieStore = await cookies();
        if (url) {
            cookieStore.set('prover_url', url, { path: '/', maxAge: 604800, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
        } else {
            cookieStore.delete('prover_url');
        }

        return NextResponse.json({ success: true, url });
    } catch (e: any) {
        return NextResponse.json({ error: String(e.message) }, { status: 500 });
    }
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const stored = cookieStore.get('prover_url')?.value || "";
        return NextResponse.json({ url: stored });
    } catch (e) {
        return NextResponse.json({ url: "" });
    }
}
