"use client";
import { useState, useEffect } from "react";

export default function ProverStatus() {
    const [status, setStatus] = useState<"checking" | "up" | "down">("checking");

    useEffect(() => {
        let isMounted = true;
        const check = async () => {
            try {
                const res = await fetch("/api/health");
                if (!isMounted) return;
                if (res.ok) setStatus("up");
                else setStatus("down");
            } catch {
                if (isMounted) setStatus("down");
            }
        };
        check();
        const int = setInterval(check, 10000);
        return () => { isMounted = false; clearInterval(int); };
    }, []);

    let color = "var(--text-muted)";
    if (status === "up") color = "var(--green)";
    if (status === "down") color = "var(--red)";

    return (
        <div
            title={`Prover API is ${status}`}
            style={{
                position: "fixed",
                top: 12,
                right: 12,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                color: "var(--text-muted)",
                background: "rgba(10, 10, 10, 0.8)",
                backdropFilter: "blur(4px)",
                padding: "4px 8px",
                borderRadius: 100,
                border: "1px solid var(--border-subtle)"
            }}
        >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: status === "up" ? "0 0 6px var(--green-dim)" : status === "down" ? "0 0 6px var(--red-dim)" : "none" }} />
            <span style={{ fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Prover {status}</span>
        </div>
    );
}

