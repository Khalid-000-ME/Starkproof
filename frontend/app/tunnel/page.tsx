"use client";
import { useState, useEffect } from "react";

export default function TunnelPage() {
    const [url, setUrl] = useState("");
    const [status, setStatus] = useState("");
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        fetch("/api/tunnel")
            .then(r => r.json())
            .then(data => {
                setUrl(data.url || "");
                setFetching(false);
            })
            .catch(() => setFetching(false));
    }, []);

    const saveUrl = async () => {
        try {
            setStatus("Saving...");
            const res = await fetch("/api/tunnel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: url.trim() })
            });

            if (!res.ok) {
                const data = await res.json();
                setStatus(`Error: ${data.error}`);
            } else {
                setStatus("Saved successfully. The frontend will now route ZK proofs to this endpoint.");
            }
        } catch (e: any) {
            setStatus("Error: " + e.message);
        }
    };

    if (fetching) return <div className="page"><div className="container" style={{ paddingTop: 40 }}>Loading...</div></div>;

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: 600, paddingTop: 40 }}>
                <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>Configure Prover API Tunnel</h1>

                <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
                    Use this private dashboard to route proof generation to your own locally hosted Prover API server (e.g., via ngrok or localtunnel).
                    No public pages link here.
                </p>

                <div className="card" style={{ padding: 24 }}>
                    <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: "bold", color: "var(--text)" }}>
                        Tunneled Prover URL
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://abc.ngrok-free.app"
                        style={{
                            width: "100%",
                            background: "var(--background)",
                            border: "1px solid var(--border)",
                            padding: "10px 14px",
                            borderRadius: "var(--radius)",
                            color: "var(--text)",
                            marginBottom: 8
                        }}
                    />
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
                        Leave empty to fall back to the default `http://127.0.0.1:8080`.
                    </p>

                    <button className="btn btn-primary w-full" onClick={saveUrl}>
                        Update Tunnel URL
                    </button>

                    {status && (
                        <div style={{ marginTop: 16, fontSize: 13, color: status.startsWith("Error") ? "var(--red)" : "var(--green)" }}>
                            {status}
                        </div>
                    )}
                </div>

                <div className="card" style={{ padding: 24, marginTop: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>How to tunnel the prover server</h2>
                    <ul style={{ paddingLeft: 16, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
                        <li>1. Start the Prover API: <code>cd prover_api && node server.js</code></li>
                        <li>2. Install ngrok natively (e.g. <code>brew install ngrok/ngrok/ngrok</code>)</li>
                        <li>3. Authenticate: <code>ngrok config add-authtoken YOUR_TOKEN</code></li>
                        <li>4. Forward port 8080: <code>ngrok http 8080</code></li>
                        <li>5. Copy the forwarding URL (e.g., `https://xxxx.ngrok-free.app`) and paste it above!</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
