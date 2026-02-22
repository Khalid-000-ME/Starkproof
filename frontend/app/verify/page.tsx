"use client";
import { useState, useRef } from "react";
import { ShieldCheckIcon, DocumentTextIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

export default function VerifyPage() {
    const [starkProof, setStarkProof] = useState("");
    const [entityIdForFetch, setEntityIdForFetch] = useState("");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const val = (ev.target?.result as string) || "";
            setStarkProof(val);
        };
        reader.readAsText(file);
    };

    async function handleAutoFetchAndVerify() {
        if (!entityIdForFetch.trim()) {
            setError("Please enter an Entity ID to auto-fetch.");
            return;
        }
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const res = await fetch(`/api/proof/${entityIdForFetch.trim()}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to fetch proof");
            }
            const data = await res.json();
            if (data.starkProofBytecode) {
                setStarkProof(data.starkProofBytecode);
                // Call verification manually with the fetched bytecode
                await handleVerifySTARK(data.starkProofBytecode, entityIdForFetch.trim());
            } else {
                throw new Error("Recent proof JSON not found for this entity.");
            }
        } catch (e: any) {
            setError(e.message || "Error fetching proof");
            setLoading(false);
        }
    }

    async function handleVerifySTARK(bytecode?: string, id?: string) {
        const proofToVerify = bytecode || starkProof;
        const eId = id || "Manual_Verification";

        if (!proofToVerify.trim()) {
            setError("Please paste the stark_proof.json bytecode.");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        try {
            const res = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityId: eId,
                    starkProofBytecode: proofToVerify,
                }),
            });
            const data = await res.json();

            if (data.error || !data.success) {
                setError(data.error || "Verification API error.");
                setResult({ isValid: false, message: data.error || "Verification API error." });
                setLoading(false);
                return;
            }

            setResult({
                isValid: data.verified,
                message: data.message || "STARK Proof verified successfully via Scarb Stwo native verifier.",
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page">
            <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 64 }}>
                <div style={{ marginBottom: 32 }}>
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldCheckIcon style={{ width: 28, height: 28, color: "var(--accent)" }} />
                        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>True ZK Solvency Verifier</h1>
                    </div>
                    <p className="text-muted mt-1" style={{ fontSize: 13, lineHeight: 1.6 }}>
                        For auditors and power users. Provide a full <code className="mono-sm text-dim">stark_proof.json</code> bytecode payload to cryptographically verify the STARK execution natively using the underlying Scarb Stwo Prover mathematical engine independently.
                    </p>
                </div>

                <div className="card card-lg mb-6">
                    <div className="section-title mb-4">Auto-Fetch Proof JSON</div>
                    <p className="text-muted text-sm mb-4">
                        If the entity has already generated a proof, you can fetch its STARK JSON bytecode automatically by providing its Entity ID.
                    </p>
                    <div className="flex gap-2">
                        <input
                            className="input w-full mono-sm"
                            placeholder="0x..."
                            value={entityIdForFetch}
                            onChange={(e) => setEntityIdForFetch(e.target.value)}
                        />
                        <button className="btn btn-secondary" onClick={handleAutoFetchAndVerify} disabled={loading}>
                            {loading ? "Fetching..." : "Auto-Fetch & Verify"}
                        </button>
                    </div>
                </div>

                <div className="card card-lg mb-6">
                    <div className="section-title flex justify-between items-center mb-4 w-full">
                        <div className="flex items-center gap-2">
                            <DocumentTextIcon style={{ width: 16, height: 16 }} /> STARK Proof Bytecode
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            {starkProof.length > 0 && (
                                <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(starkProof)}>
                                    Copy Full JSON
                                </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                                Upload JSON
                            </button>
                        </div>
                        <input type="file" ref={fileRef} accept=".json" style={{ display: "none" }} onChange={handleFileUpload} />
                    </div>

                    <div className="field mb-4">
                        <textarea
                            className="input input-mono w-full"
                            style={{ minHeight: "250px", resize: "vertical" }}
                            placeholder='{"proof": {"commitments": ...'
                            value={starkProof.length > 3000 ? starkProof.slice(0, 500) + "\n\n... [Bytecode Truncated for View] ...\n\n" + starkProof.slice(-500) : starkProof}
                            onChange={(e) => setStarkProof(e.target.value)}
                        />
                    </div>
                </div>

                {error && (
                    <div className="alert alert-error mb-4">
                        {error}
                    </div>
                )}

                {result && (
                    <div className={`card card-lg mb-4 ${result.isValid ? "alert-success" : "alert-error"}`} style={{ padding: "24px" }}>
                        <div className="flex items-center gap-3 mb-2">
                            {result.isValid ? (
                                <CheckCircleIcon style={{ width: 24, height: 24, color: "var(--green)" }} />
                            ) : (
                                <XCircleIcon style={{ width: 24, height: 24, color: "var(--red)" }} />
                            )}
                            <div style={{ fontSize: 16, fontWeight: 600 }}>
                                {result.isValid ? "Proof Validated Successfully" : "Proof Verification Failed"}
                            </div>
                        </div>
                        <p className="text-muted" style={{ fontSize: 13 }}>{result.message}</p>
                    </div>
                )}

                <div className="flex items-center justify-between mt-4 border-t border-subtle" style={{ paddingTop: 24 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-primary" onClick={() => handleVerifySTARK()} disabled={loading}>
                            {loading ? <><span className="spinner" /> Verifying natively...</> : <><ShieldCheckIcon style={{ width: 15, height: 15 }} /> Verify STARK Proof</>}
                        </button>
                        <button className="btn btn-ghost" onClick={() => { setStarkProof(""); setResult(null); setError(""); }}>
                            Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
