"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { provider, REGISTRY_ADDRESS, feltToHash } from "@/lib/starknet";
import ProofStatusBadge from "@/components/ProofStatusBadge";
import ReserveRatioBand from "@/components/ReserveRatioBand";
import ProofCountdown from "@/components/ProofCountdown";
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { hash } from "starknet";

// ── helpers ────────────────────────────────────────────────────────────────────
function feltToName(hex: string): string {
    let h = BigInt(hex).toString(16);
    if (h.length % 2) h = "0" + h;
    let s = "";
    for (let i = 0; i < h.length; i += 2) {
        const c = parseInt(h.slice(i, i + 2), 16);
        if (c > 0) s += String.fromCharCode(c);
    }
    return s.trim() || "Unknown";
}

function formatTimestamp(ts: bigint): string {
    if (ts === 0n) return "—";
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function bandLabel(b: number) {
    return ["—", "100–110%", "110–120%", "≥ 120%"][b] || "—";
}

export default function EntityPage() {
    const params = useParams();
    const idParam = params.id as string;

    const [loading, setLoading] = useState(true);
    const [entity, setEntity] = useState<any>(null);
    const [notFound, setNotFound] = useState(false);

    // Verification widget state
    const [accountId, setAccountId] = useState("");
    const [balanceSat, setBalanceSat] = useState("");
    const [merklePath, setMerklePath] = useState("");
    const [verifyResult, setVerifyResult] = useState<"none" | "success" | "fail">("none");

    // True ZK verify state
    const [starkProof, setStarkProof] = useState("");
    const [verifySTARKLoading, setVerifySTARKLoading] = useState(false);
    const [verifySTARKResult, setVerifySTARKResult] = useState<"none" | "success" | "fail">("none");
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function fetchEntity() {
            try {
                // Ensure idParam is in the hex format without 0x or with 0x depending on how we saved it
                // We'll normalize to 0x-prefixed 64 char hex to match the registry inputs
                let idHex = idParam.toLowerCase();
                if (!idHex.startsWith("0x")) idHex = "0x" + idHex;
                // We need the exactly stored felt252, which could have leading zeros.
                // callContract get_entity takes the felt id.
                const rec = await provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint: "get_entity", calldata: [idHex] }).catch(() => null);

                if (!rec || rec[0] === "0x0" || rec[0] === "0") {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }

                const prf = await provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint: "get_proof_record", calldata: [idHex] });
                const r_height = BigInt(prf[1]);
                const r_root = prf[2];
                const r_band = Number(BigInt(prf[3]));
                const r_timestamp = BigInt(prf[4]);
                const r_is_valid = BigInt(prf[5]) !== 0n;
                const r_expiry = BigInt(prf[6]);
                const r_count = Number(BigInt(prf[7]));

                const nowSec = BigInt(Math.floor(Date.now() / 1000));
                let status = "NeverProven";
                if (!r_is_valid || r_timestamp === 0n) status = "NeverProven";
                else if (r_expiry < nowSec) status = "Expired";
                else if (r_expiry - nowSec < BigInt(72 * 3600)) status = "Expiring";
                else status = "Active";

                // Fetch real on-chain events for the submission log
                let log: any[] = [];
                try {
                    const eventKey = hash.getSelectorFromName("ProofSubmitted");
                    // Fetch latest events for this contract
                    const currentBlock = await provider.getBlockNumber();
                    const fromBlock = Math.max(0, currentBlock - 50000);

                    let allEvents: any[] = [];
                    let continuationToken: string | undefined = undefined;

                    do {
                        const eventsRes = await provider.getEvents({
                            from_block: { block_number: fromBlock },
                            address: REGISTRY_ADDRESS,
                            keys: [[eventKey], [idHex]],
                            chunk_size: 100,
                            continuation_token: continuationToken
                        });

                        allEvents = allEvents.concat(eventsRes.events);
                        continuationToken = eventsRes.continuation_token;
                    } while (continuationToken);

                    log = allEvents.map((evt) => ({
                        ts: BigInt(evt.data[2]),
                        block: Number(BigInt(evt.data[0])),
                        band: Number(BigInt(evt.data[1])),
                        txHash: evt.transaction_hash
                    }));

                    log.sort((a, b) => Number(b.ts) - Number(a.ts));
                } catch (e) {
                    console.error("Failed to fetch events from node", e);
                }

                setEntity({
                    id: idHex,
                    name: feltToName(rec[0]),
                    status,
                    band: r_band,
                    blockHeight: r_height,
                    proofTimestamp: r_timestamp,
                    expiryTimestamp: r_expiry,
                    submissionCount: r_count,
                    merkleRoot: r_root,
                    log
                });

            } catch (err) {
                console.error("Error loading entity", err);
                setNotFound(true);
            }
            setLoading(false);
        }

        fetchEntity();
    }, [idParam]);

    async function handleVerifySTARK(bytecode?: string) {
        const payload = bytecode || starkProof;
        if (!payload.trim()) return;
        setVerifySTARKLoading(true);
        setVerifySTARKResult("none");

        try {
            const res = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityId: entity?.id,
                    starkProofBytecode: payload
                })
            });

            if (!res.ok) throw new Error("Verification failed on API");

            const data = await res.json();
            if (data.verified) {
                setVerifySTARKResult("success");
            } else {
                setVerifySTARKResult("fail");
            }
        } catch (e) {
            console.error(e);
            setVerifySTARKResult("fail");
        }

        setVerifySTARKLoading(false);
    }

    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const val = (ev.target?.result as string) || "";
            setStarkProof(val);
        };
        reader.readAsText(file);
    }

    async function handleAutoFetchAndVerify() {
        setVerifySTARKLoading(true);
        try {
            const res = await fetch(`/api/proof/${entity?.id}`);
            const data = await res.json();
            if (data.starkProofBytecode) {
                setStarkProof(data.starkProofBytecode);
                await handleVerifySTARK(data.starkProofBytecode);
            } else {
                alert("Recent proof JSON not found for this entity on the server log.");
            }
        } catch (e) {
            alert("Error fetching proof: " + String(e));
        } finally {
            setVerifySTARKLoading(false);
        }
    }

    // Inclusion proof verification logic
    function handleVerify() {
        if (!accountId || !balanceSat || !entity?.merkleRoot) return;

        try {
            // Hash the account ID similar to stringToFelt252 in merkle.ts
            // In a real system, the exchange would provide the exact `leaf` hash or parameters.
            let accFelt = 0n;
            for (const char of accountId) {
                accFelt = (accFelt << 8n) | BigInt(char.charCodeAt(0));
            }
            accFelt = accFelt % (2n ** 251n);

            const bal = BigInt(balanceSat);

            // Expected leaf = poseidon(accFelt, bal)
            const leaf = BigInt(hash.computePoseidonHashOnElements(["0x" + accFelt.toString(16), "0x" + bal.toString(16)]));

            // Path should be JSON array of strings/hex
            let pathObj = [];
            if (merklePath.trim()) {
                pathObj = JSON.parse(merklePath);
            }

            let currentHash = leaf;
            // E.g. [{"side":"left","hash":"0xabc..."}, {"side":"right","hash":"0xdef..."}]
            for (const p of pathObj) {
                if (p.side === "left") {
                    currentHash = BigInt(hash.computePoseidonHashOnElements([p.hash, "0x" + currentHash.toString(16)]));
                } else {
                    currentHash = BigInt(hash.computePoseidonHashOnElements(["0x" + currentHash.toString(16), p.hash]));
                }
            }

            const expectedRoot = BigInt(entity.merkleRoot);
            if (currentHash === expectedRoot) setVerifyResult("success");
            else setVerifyResult("fail");

        } catch (e) {
            console.error("Verification failed to execute", e);
            setVerifyResult("fail");
        }
    }

    if (loading) {
        return (
            <div className="page" style={{ minHeight: "60vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", alignItems: "center" }}><span className="spinner" /> Loading entity records...</div>
            </div>
        );
    }

    if (notFound || !entity) {
        return (
            <div className="page">
                <div className="container" style={{ paddingTop: 48, textAlign: "center" }}>
                    <h1 style={{ fontSize: 20, fontWeight: 700 }}>Entity Not Found</h1>
                    <p className="text-muted mt-2">No entity registered with ID: <code className="mono-sm">{idParam}</code></p>
                    <Link href="/registry" className="btn btn-secondary mt-4">Back to Registry</Link>
                </div>
            </div>
        );
    }

    const RootStr = BigInt(entity.merkleRoot).toString(16);
    const rootDisplay = "0x" + RootStr.padStart(64, "0");

    const nameParts = entity.name.split("|");
    const displayName = nameParts[0];
    const tokenName = nameParts[1] || "";
    const networkName = nameParts[2] || "";

    return (
        <div className="page">
            <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 mb-4 text-muted text-sm">
                    <Link href="/registry" style={{ color: "var(--text-muted)" }}>Registry</Link>
                    <span>/</span>
                    <span>{displayName}</span>
                    {tokenName && (
                        <>
                            <span>/</span>
                            <span style={{ color: "var(--green)" }}>{tokenName}</span>
                            <span>({networkName})</span>
                        </>
                    )}
                </div>

                {/* Header */}
                <div className="card card-lg mb-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 style={{ fontSize: 22, fontWeight: 700 }}>{displayName}</h1>
                                {tokenName && (
                                    <div className="badge" style={{ background: "var(--surface-3)", color: "var(--green)" }}>
                                        {tokenName} • {networkName}
                                    </div>
                                )}
                                <ProofStatusBadge status={entity.status} />
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="text-muted text-sm">
                                    Reserve Band: <strong style={{ color: "var(--text)" }}>{bandLabel(entity.band)}</strong>
                                </div>
                                <div className="text-muted text-sm">
                                    BTC Block: <strong className="mono-sm" style={{ color: "var(--text)" }}>{entity.blockHeight > 0n ? `#${Number(entity.blockHeight).toLocaleString()}` : "—"}</strong>
                                </div>
                                <div className="text-muted text-sm">
                                    Expires: <ProofCountdown expiryTimestamp={entity.expiryTimestamp} />
                                </div>
                            </div>
                        </div>
                        <ReserveRatioBand band={entity.band} />
                    </div>
                </div>

                <div className="grid-2" style={{ gap: 16 }}>
                    {/* Public Proof Information */}
                    <div className="card">
                        <div className="section-title mb-3">On-Chain Proof Truth</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {[
                                { label: "Entity ID", value: entity.id, mono: true },
                                { label: "Merkle Root", value: rootDisplay, mono: true },
                                { label: "Total Submissions", value: entity.submissionCount.toString(), mono: true },
                                { label: "Latest Proof", value: formatTimestamp(entity.proofTimestamp), mono: false },
                                { label: "Expiry Date", value: formatTimestamp(entity.expiryTimestamp), mono: false },
                            ].map(({ label, value, mono }) => (
                                <div key={label} className="flex justify-between items-center" style={{ paddingBottom: 8, borderBottom: "1px solid var(--border-subtle)" }}>
                                    <span className="text-muted text-sm">{label}</span>
                                    <span className={mono ? "mono-sm" : "text-sm"} style={{ color: "var(--text)", maxWidth: 220, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* True ZK Solvency Verification Widget */}
                    <div className="card">
                        <div className="section-title mb-1 flex justify-between items-center w-full">
                            <span>Verify True ZK Solvency</span>
                            <div className="flex gap-2">
                                <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                                    Upload JSON
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={handleAutoFetchAndVerify}>
                                    Auto-Fetch & Verify
                                </button>
                                <input type="file" ref={fileRef} accept=".json" style={{ display: "none" }} onChange={handleFileUpload} />
                            </div>
                        </div>
                        <p className="text-muted text-sm mb-4 mt-2">
                            Run the full Cairo STARK Verification check to mathematically prove total reserves exceed exactly this Merkle tree&apos;s liability sum.
                        </p>
                        <div className="mb-4">
                            <textarea
                                className="input mono-sm w-full"
                                style={{ minHeight: "80px", resize: "vertical", fontSize: 11 }}
                                placeholder='Paste stark_proof.json bytecode here OR click "Upload JSON"'
                                value={starkProof.length > 3000 ? starkProof.slice(0, 500) + "\n\n... [Bytecode Truncated for View] ...\n\n" + starkProof.slice(-500) : starkProof}
                                onChange={e => setStarkProof(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 items-center">
                            <button className="btn btn-secondary btn-sm" onClick={() => handleVerifySTARK()} disabled={verifySTARKLoading}>
                                {verifySTARKLoading ? "Verifying STARK Trace..." : "Verify STARK Proof"}
                            </button>
                            {verifySTARKResult === "success" && <div className="badge badge-green"><CheckCircleIcon style={{ width: 14, height: 14 }} /> Verified Solvency</div>}
                            {verifySTARKResult === "fail" && <div className="badge badge-red"><XCircleIcon style={{ width: 14, height: 14 }} /> Invalid STARK</div>}
                        </div>
                    </div>

                    {/* Inclusion Verification Widget */}
                    <div className="card">
                        <div className="section-title mb-1">Verify Inclusion</div>
                        <p className="text-muted text-sm mb-4">
                            Check if your balance is included in the liability Merkle tree.
                        </p>
                        <div className="flex items-center gap-2 mb-3">
                            <input className="input" placeholder="Account ID" value={accountId} onChange={e => setAccountId(e.target.value)} />
                            <input className="input" placeholder="Balance (satoshi)" value={balanceSat} onChange={e => setBalanceSat(e.target.value)} type="number" />
                        </div>
                        <div className="mb-4">
                            <input className="input mono-sm" placeholder='Merkle branch JSON (e.g. [{"side":"left","hash":"0x..."}])' value={merklePath} onChange={e => setMerklePath(e.target.value)} />
                        </div>
                        <div className="flex gap-2 items-center">
                            <button className="btn btn-secondary btn-sm" onClick={handleVerify}>
                                Verify Cryptographically
                            </button>
                            {verifyResult === "success" && <div className="badge badge-green"><CheckCircleIcon style={{ width: 14, height: 14 }} /> Verified</div>}
                            {verifyResult === "fail" && <div className="badge badge-red"><XCircleIcon style={{ width: 14, height: 14 }} /> Invalid</div>}
                        </div>
                    </div>

                    {/* Submission log */}
                    {entity.log.length > 0 && (
                        <div className="card" style={{ gridColumn: "1 / -1" }}>
                            <div className="section-header">
                                <div className="section-title">Submission Log</div>
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            <th>BTC Block</th>
                                            <th>Reserve Band</th>
                                            <th>Transaction</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entity.log.map((row: any, i: number) => (
                                            <tr key={i}>
                                                <td className="text-muted">{formatTimestamp(row.ts)}</td>
                                                <td className="mono-sm text-muted">#{row.block.toLocaleString()}</td>
                                                <td><ReserveRatioBand band={row.band} size="sm" /></td>
                                                <td>
                                                    <a
                                                        href={`https://sepolia.voyager.online/tx/${row.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mono-sm"
                                                        style={{ color: "var(--accent)" }}
                                                    >
                                                        {row.txHash.slice(0, 14)}...
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
