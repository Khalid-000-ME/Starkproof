"use client";
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { provider, REGISTRY_ADDRESS, feltToHash } from "@/lib/starknet";
import { computeProofCommitment, computeLiabilityRoot, computeMerkleBranch } from "@/lib/merkle";
import ProofStatusBadge from "@/components/ProofStatusBadge";
import ReserveRatioBand from "@/components/ReserveRatioBand";
import ProofCountdown from "@/components/ProofCountdown";
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { hash } from "starknet";

const AUTHORIZED_WALLETS = ["0x044bee7bb2e611f5d0d10026ec411bf0617ac9d58b640ff5587f2a163c117b6d"];


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

    // Simulated verify state
    const [simulatedProof, setSimulatedProof] = useState("");
    const [verifySimulatedLoading, setVerifySimulatedLoading] = useState(false);
    const [verifySimulatedResult, setVerifySimulatedResult] = useState<any>(null);

    // Logs expanded row
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

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

                // Fetch real on-chain events and history items to get exact proof commitments
                let log: any[] = [];
                try {
                    const eventKey = hash.getSelectorFromName("ProofSubmitted");
                    const currentBlock = await provider.getBlockNumber();
                    const fromBlock = Math.max(0, currentBlock - 500000); // 500k blocks

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

                    // Fetch history items to get exact liability roots
                    const historyPromises = [];
                    for (let i = 1; i <= r_count; i++) {
                        historyPromises.push(provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint: "get_proof_history_item", calldata: [idHex, i.toString()] }).catch(() => null));
                    }
                    const historyResults = await Promise.all(historyPromises);

                    log = historyResults.filter(Boolean).map((res: any, index: number) => {
                        const recBlockHeight = Number(BigInt(res[1]));
                        const recRoot = res[2];
                        const recBand = Number(BigInt(res[3]));
                        const recTs = BigInt(res[4]);

                        // Compute standard matching commitment
                        const commitHash = computeProofCommitment(
                            BigInt(idHex),
                            BigInt(recBlockHeight),
                            BigInt(recRoot),
                            recBand,
                            recTs
                        );

                        // Try find matching event for txHash
                        const evt = allEvents.find(e => BigInt(e.data[2]) === recTs && Number(BigInt(e.data[0])) === recBlockHeight);

                        return {
                            ts: recTs,
                            block: recBlockHeight,
                            band: recBand,
                            liabilityRoot: "0x" + BigInt(recRoot).toString(16).padStart(64, '0'),
                            proofCommitment: "0x" + commitHash.toString(16).padStart(64, '0'),
                            txHash: evt ? evt.transaction_hash : "—"
                        };
                    });

                    log.sort((a, b) => Number(b.ts) - Number(a.ts));
                } catch (e) {
                    console.error("Failed to fetch event history", e);
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
                    registrant: feltToHash(rec[2]),
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

    async function handleVerifySimulated() {
        if (!simulatedProof || !entity) return;
        setVerifySimulatedLoading(true);
        setVerifySimulatedResult(null);

        try {
            const res = await fetch("/api/verify/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    proof: simulatedProof,
                    public_inputs: {
                        entity_id: entity.id,
                        block_height: Number(entity.blockHeight),
                        liability_merkle_root: entity.merkleRoot,
                        reserve_ratio_band: entity.band,
                        proof_timestamp: Number(entity.proofTimestamp),
                    },
                }),
            });
            const data = await res.json();

            if (data.error) {
                setVerifySimulatedResult({ isValid: false, message: data.error });
            } else {
                setVerifySimulatedResult({
                    isValid: data.is_valid,
                    message: data.note || (data.is_valid ? "Off-Chain commitment verification passed." : "Invalid proof commitment."),
                    gasUsed: Math.floor(Math.random() * 500) + 200
                });
            }
        } catch (e: any) {
            setVerifySimulatedResult({ isValid: false, message: e.message });
        } finally {
            setVerifySimulatedLoading(false);
        }
    }

    async function handleAutoFetchAndVerifySimulated() {
        if (!entity?.id) return;
        setVerifySimulatedLoading(true);
        setVerifySimulatedResult(null);

        try {
            const res = await fetch(`/api/proof/${entity.id}`);
            if (!res.ok) throw new Error("API failed");
            const data = await res.json();
            if (data.proofCommitment) {
                setSimulatedProof(data.proofCommitment);

                // Do the simulated verify request right away (just like handleVerifySimulated)
                const verifyRes = await fetch("/api/verify/manual", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        proof: data.proofCommitment,
                        public_inputs: {
                            entity_id: entity.id,
                            block_height: Number(entity.blockHeight),
                            liability_merkle_root: entity.merkleRoot,
                            reserve_ratio_band: entity.band,
                            proof_timestamp: Number(entity.proofTimestamp),
                        },
                    }),
                });
                const verifyData = await verifyRes.json();
                if (verifyData.error) {
                    setVerifySimulatedResult({ isValid: false, message: verifyData.error });
                } else {
                    setVerifySimulatedResult({
                        isValid: verifyData.is_valid,
                        message: verifyData.note || (verifyData.is_valid ? "Off-Chain commitment verification passed." : "Invalid proof commitment."),
                        gasUsed: Math.floor(Math.random() * 500) + 200
                    });
                }
            } else {
                setVerifySimulatedResult({ isValid: false, message: "No local proof commitment record found." });
            }
        } catch (e: any) {
            setVerifySimulatedResult({ isValid: false, message: e.message || "Error fetching local commitment." });
        } finally {
            setVerifySimulatedLoading(false);
        }
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
            setVerifyResult("none");
        }
    }

    // Reference for the mock CSV file upload
    const branchCsvRef = useRef<HTMLInputElement>(null);

    function handleBranchCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!accountId || !balanceSat) {
            alert("Please input your Account ID and Balance before uploading the CSV.");
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const csvData = (ev.target?.result as string) || "";
                // Parse CSV and build the full tree exactly as the operator did
                const { root, leaves, leafHashes } = computeLiabilityRoot(csvData);

                // Ensure the extracted root matches what is on-chain (sanity check)
                if (BigInt(root) !== BigInt(entity.merkleRoot)) {
                    alert("The uploaded CSV produces a different total Merkle Root than the one published on-chain! This implies the operator used different data.");
                    return;
                }

                // Find the user's index in the CSV
                const targetIndex = leaves.findIndex(l => l.id.trim() === accountId.trim());
                
                if (targetIndex === -1) {
                    alert("Your Account ID was NOT found in this CSV.");
                    return;
                }

                // Verify the balance matches the CSV record
                if (leaves[targetIndex].amount !== BigInt(balanceSat)) {
                    alert(`Balance mismatch! You entered ${balanceSat}, but the CSV says ${leaves[targetIndex].amount.toString()}`);
                    return;
                }

                // Everything matches, generate the exact mathematical branch!
                const realBranch = computeMerkleBranch(leafHashes, targetIndex);
                setMerklePath(JSON.stringify(realBranch));

                setTimeout(() => {
                    document.getElementById('verify-btn')?.click();
                }, 100);

            } catch (err: any) {
                alert("Failed to parse branch from CSV: " + err.message);
            }
            
            // Reset file input
            if (branchCsvRef.current) branchCsvRef.current.value = "";
        };
        reader.readAsText(file);
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
                        </>
                    )}
                </div>

                {/* Header */}
                <div className="card card-lg mb-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                                    {displayName}
                                    {entity.registrant && AUTHORIZED_WALLETS.includes(entity.registrant) && <CheckCircleIcon style={{ width: 18, height: 18, color: "var(--green)" }} title="Verified Authorized Tracker" />}
                                </h1>
                                {tokenName && (
                                    <div className="badge" style={{ background: "var(--surface-3)", color: "var(--green)" }}>
                                        {tokenName}
                                    </div>
                                )}
                                <ProofStatusBadge status={entity.status} />
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="text-muted text-sm">
                                    Reserve Band: <strong style={{ color: "var(--text)" }}>{bandLabel(entity.band)}</strong>
                                </div>
                                <div className="text-muted text-sm">
                                    Snapshot Block: <strong className="mono-sm" style={{ color: "var(--text)" }}>{entity.blockHeight > 0n ? `#${Number(entity.blockHeight).toLocaleString()}` : "—"}</strong>
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
                    {/* Left Column: Info & Whitelists */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Public Proof Information */}
                        <div className="card">
                            <div className="section-title mb-3">On-Chain Proof Truth</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {[
                                    { label: "Entity ID", value: entity.id, mono: true },
                                    { label: "Authorized Wallet", value: entity.registrant || "Unknown", mono: true },
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

                        {/* Verified Allowed Submitter Tracking */}
                        <div className="card">
                            <div className="section-title mb-3">Authorized Verification Wallets</div>
                            <p className="text-muted text-sm mb-4" style={{ lineHeight: 1.5 }}>
                                The exact Starknet on-chain addresses allowed to submit cryptographically valid solvency commitments for this entity.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {entity.registrant && entity.registrant !== "0x0" ? (
                                    <div className="flex justify-between items-center" style={{ padding: "8px 12px", background: "var(--surface-2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                                        <div className="flex items-center gap-2">
                                            <CheckCircleIcon style={{ width: 14, height: 14, color: "var(--green)" }} />
                                            <span className="text-muted text-xs">Approved Submitter</span>
                                        </div>
                                        <span className="mono-sm" style={{ color: "var(--text)" }}>{entity.registrant.substring(0, 8)}...{entity.registrant.substring(entity.registrant.length - 6)}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted text-sm">No authorized wallets.</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* True ZK Solvency Verification Widget */}
                    <div className="card">
                        <div className="section-title mb-1 flex justify-between items-center w-full flex-wrap" style={{ gap: "12px" }}>
                            <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Verify True ZK Solvency</span>
                            <div className="flex flex-wrap gap-2">
                                {starkProof.length > 0 && (
                                    <>
                                        <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(starkProof)}>
                                            Copy Full JSON
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => {
                                            const blob = new Blob([starkProof], { type: "application/json" });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = `starkproof_${entity.id.substring(0, 8)}.json`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                        }}>
                                            Download JSON
                                        </button>
                                    </>
                                )}
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

                    {/* Off-Chain Commitment Verification Widget */}
                    <div className="card">
                        <div className="section-title mb-1 flex justify-between items-center w-full">
                            <span>Off-Chain Commitment Verification</span>
                        </div>
                        <p className="text-muted text-sm mb-4 mt-2">
                            Verify the proof using the proof-of-commitment method without relying on active registry indexes. Requires the proof commitment hash natively matching exactly the public inputs tracked on-chain.
                        </p>
                        <div className="mb-4">
                            <input
                                className="input mono-sm w-full"
                                placeholder='Proof Commitment Hash (0x...)'
                                value={simulatedProof}
                                onChange={e => setSimulatedProof(e.target.value)}
                            />
                        </div>
                        {verifySimulatedResult && (
                            <div className={`alert mb-4 ${verifySimulatedResult.isValid ? 'alert-success' : 'alert-error'}`} style={{ alignItems: "center" }}>
                                {verifySimulatedResult.isValid ? <CheckCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} /> : <XCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />}
                                <span>{verifySimulatedResult.message}</span>
                            </div>
                        )}
                        <div className="flex gap-2 items-center mt-2">
                            <button className="btn btn-secondary btn-sm" onClick={handleVerifySimulated} disabled={verifySimulatedLoading}>
                                {verifySimulatedLoading ? "Verifying Off-Chain..." : "Verify Commitment"}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={handleAutoFetchAndVerifySimulated} disabled={verifySimulatedLoading}>
                                Auto-Load & Verify
                            </button>
                        </div>
                    </div>

                    {/* Inclusion Verification Widget */}
                    <div className="card">
                        <div className="section-title mb-1 flex justify-between items-center w-full">
                            <span>Verify Inclusion</span>
                            <div className="flex gap-2">
                                <button className="btn btn-secondary btn-sm" onClick={() => branchCsvRef.current?.click()}>
                                    Fetch Branch from CSV
                                </button>
                                <input type="file" accept=".csv" ref={branchCsvRef} style={{ display: "none" }} onChange={handleBranchCsvUpload} />
                            </div>
                        </div>
                        <p className="text-muted text-sm mb-4">
                            Check if your balance is included in the liability Merkle tree. Enter your Account ID before Auto-Verifying.
                        </p>
                        <div className="flex items-center gap-2 mb-3">
                            <input className="input" placeholder="Account ID" value={accountId} onChange={e => setAccountId(e.target.value)} />
                            <input className="input" placeholder="Balance (satoshi)" value={balanceSat} onChange={e => setBalanceSat(e.target.value)} type="number" />
                        </div>
                        <div className="mb-4">
                            <input className="input mono-sm" placeholder='Merkle branch JSON (e.g. [{"side":"left","hash":"0x..."}])' value={merklePath} onChange={e => setMerklePath(e.target.value)} />
                        </div>
                        <div className="flex gap-2 items-center">
                            <button id="verify-btn" className="btn btn-secondary btn-sm" onClick={handleVerify}>
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
                                            <React.Fragment key={i}>
                                                <tr onClick={() => setExpandedRow(expandedRow === i ? null : i)} style={{ cursor: "pointer", borderBottom: expandedRow === i ? "none" : "" }}>
                                                    <td className="text-muted">{new Date(Number(row.ts) * 1000).toLocaleString()}</td>
                                                    <td className="mono-sm text-muted">#{row.block.toLocaleString()}</td>
                                                    <td><ReserveRatioBand band={row.band} size="sm" /></td>
                                                    <td>
                                                        {row.txHash !== "—" ? (
                                                            <a
                                                                href={`https://sepolia.voyager.online/tx/${row.txHash}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="mono-sm"
                                                                style={{ color: "var(--accent)" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {row.txHash.slice(0, 14)}...
                                                            </a>
                                                        ) : (
                                                            <span className="mono-sm text-muted">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {expandedRow === i && (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: "0 12px 12px 12px", borderTop: "none" }}>
                                                            <div style={{ background: "var(--surface-2)", padding: "12px 16px", borderRadius: "var(--radius)", fontSize: "12px", color: "var(--text-muted)" }}>
                                                                <div className="flex flex-col gap-2 mb-2">
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Proof Timestamp (Seconds)</span>
                                                                        <span className="mono-sm" style={{ color: "var(--text)" }}>{row.ts.toString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>BTC Block Height</span>
                                                                        <span className="mono-sm" style={{ color: "var(--text)" }}>{row.block.toString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Reserve Ratio Band</span>
                                                                        <span className="mono-sm" style={{ color: "var(--text)" }}>{row.band.toString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Liability Merkle Root</span>
                                                                        <span className="mono-sm" style={{ color: "var(--text)", wordBreak: "break-all", maxWidth: "60%" }}>{row.liabilityRoot}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center pt-2 mt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                                                                        <span style={{ color: "var(--text)" }}>Proof Commitment Hash</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="mono-sm" style={{ color: "var(--text)", wordBreak: "break-all", maxWidth: "100%" }}>{row.proofCommitment}</span>
                                                                            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(row.proofCommitment); }} style={{ padding: "2px 6px" }}>Copy</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center mt-4">
                                                                    <span className="text-xs" style={{ color: "var(--green)", fontWeight: 500 }}>Use these specific values for verifying this point in time off-chain.</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
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
