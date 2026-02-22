"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import {
    ShieldCheckIcon,
    ClockIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    ChartBarIcon,
    ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { provider, REGISTRY_ADDRESS, feltToHash } from "@/lib/starknet";
import dynamic from "next/dynamic";
import EntityTable, { type EntityRow } from "@/components/EntityTable";

const ProofTimeline = dynamic(() => import("@/components/charts/ProofTimeline"), { ssr: false });

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
    return new Date(Number(ts) * 1000).toLocaleString();
}

function daysUntil(ts: bigint): number {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const diff = Number(ts - now);
    return Math.max(0, Math.floor(diff / 86400));
}

function hoursUntil(ts: bigint): number {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const diff = Number(ts - now);
    return Math.max(0, Math.floor(diff / 3600));
}

interface EntityData {
    id: string;
    name: string;
    status: "Active" | "Expiring" | "Expired" | "NeverProven";
    band: number;
    blockHeight: bigint;
    proofTimestamp: bigint;
    expiryTimestamp: bigint;
    submissionCount: number;
}

// ── component ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const { address, isConnected } = useAccount();
    const [entities, setEntities] = useState<EntityRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [targetWallet, setTargetWallet] = useState<string>("");

    useEffect(() => {
        if (address && !targetWallet) {
            setTargetWallet(address);
        }
    }, [address]);

    async function callContract(entrypoint: string, calldata: string[] = []): Promise<string[]> {
        return provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint, calldata });
    }

    async function loadEntityForWallet(addr: string, forceRefresh = false) {
        setLoading(true);
        setNotFound(false);
        try {
            const cacheKey = `dashboard_entities_${feltToHash(addr)}`;
            if (!forceRefresh) {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const restored: EntityRow[] = parsed.map((p: any) => ({
                        ...p,
                        blockHeight: BigInt(p.blockHeight),
                        proofTimestamp: BigInt(p.proofTimestamp),
                        expiryTimestamp: BigInt(p.expiryTimestamp)
                    }));
                    setEntities(restored);
                    setLoading(false);
                    return;
                }
            }

            const countRes = await callContract("get_entity_count");
            const count = Number(BigInt(countRes[0]));
            const found: EntityRow[] = [];
            for (let i = 0; i < count; i++) {
                const idRes = await callContract("get_entity_id_at", [String(i)]);
                const id = idRes[0];
                const rec = await callContract("get_entity", [id]);
                // rec[2] is the registrant address
                if (rec[2]?.toLowerCase() === addr.toLowerCase() || feltToHash(rec[2]) === feltToHash(addr)) {
                    const prf = await callContract("get_proof_record", [id]);
                    const r_height = BigInt(prf[1]);
                    const r_band = Number(BigInt(prf[3]));
                    const r_timestamp = BigInt(prf[4]);
                    const r_is_valid = BigInt(prf[5]) !== 0n;
                    const r_expiry = BigInt(prf[6]);
                    const r_count = Number(BigInt(prf[7]));
                    const nowSec = BigInt(Math.floor(Date.now() / 1000));
                    let status: EntityRow["status"] = "NeverProven";
                    if (!r_is_valid || r_timestamp === 0n) status = "NeverProven";
                    else if (r_expiry < nowSec) status = "Expired";
                    else if (r_expiry - nowSec < BigInt(72 * 3600)) status = "Expiring";
                    else status = "Active";
                    found.push({ id: feltToHash(id), name: feltToName(rec[0]), status, band: r_band, blockHeight: r_height, proofTimestamp: r_timestamp, expiryTimestamp: r_expiry, submissionCount: r_count, registrant: feltToHash(rec[2]) });
                }
            }
            if (found.length > 0) {
                setEntities(found);

                // Cache the result. BigInt must be converted to string.
                const cacheable = found.map(e => ({
                    ...e,
                    blockHeight: e.blockHeight.toString(),
                    proofTimestamp: e.proofTimestamp.toString(),
                    expiryTimestamp: e.expiryTimestamp.toString()
                }));
                sessionStorage.setItem(`dashboard_entities_${feltToHash(addr)}`, JSON.stringify(cacheable));
            } else {
                setNotFound(true);
            }
        } catch (e) {
            console.error(e);
            setNotFound(true);
        }
        setLoading(false);
    }

    useEffect(() => {
        if (targetWallet) loadEntityForWallet(targetWallet);
        else setLoading(false);
    }, [address, targetWallet]);


    // ── not connected ──────────────────────────────────────────────────────────
    if (!isConnected) {
        return (
            <div className="page">
                <div className="container-narrow" style={{ paddingTop: 80, paddingBottom: 48 }}>
                    <div className="card card-lg" style={{ textAlign: "center", padding: "64px 40px" }}>
                        <ShieldCheckIcon style={{ width: 40, height: 40, color: "var(--text-dim)", margin: "0 auto 20px" }} />
                        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Operator Dashboard</h1>
                        <p className="text-muted" style={{ marginBottom: 28, maxWidth: 340, margin: "0 auto 28px" }}>
                            Connect your Braavos wallet to view your entity&apos;s live solvency status and proof history.
                        </p>
                        <Link href="/onboard" className="btn btn-primary">
                            Connect and Register
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="page">
                <div className="container" style={{ paddingTop: 48 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
                        <span className="spinner" /> Looking up entity for connected wallet...
                    </div>
                </div>
            </div>
        );
    }

    // ── rendering ──────────────────────────────────────────────────────────────

    return (
        <div className="page">
            <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Operator Dashboard</h1>
                        <p className="text-muted mt-1" style={{ fontSize: 13 }}>
                            {entities.length} registered asset{entities.length === 1 ? '' : 's'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={async () => { setRefreshing(true); await loadEntityForWallet(targetWallet, true); setRefreshing(false); }}
                            disabled={refreshing}
                        >
                            <ArrowPathIcon style={{ width: 14, height: 14 }} />
                            {refreshing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "Refresh"}
                        </button>
                        <Link href="/prove" className="btn btn-primary btn-sm">
                            Submit / Renew Proof
                        </Link>
                    </div>
                </div>

                <div className="card mt-4">
                    <div className="mb-6 pb-6" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <label className="label" style={{ marginBottom: 8, display: "block" }}>
                            Target Authorized Wallet Address
                            <span className="text-muted ml-2" style={{ fontWeight: 400 }}>(For Delegated Signers)</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="input input-mono w-full"
                                placeholder={`e.g. ${address}`}
                                value={targetWallet}
                                onChange={(e) => setTargetWallet(e.target.value)}
                            />
                            <button
                                className="btn btn-secondary"
                                onClick={async () => { setRefreshing(true); await loadEntityForWallet(targetWallet, true); setRefreshing(false); }}
                                disabled={refreshing || !targetWallet}
                            >
                                {refreshing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Lookup"}
                            </button>
                        </div>
                    </div>

                    <div className="section-title mb-4">Registered Entities</div>
                    {(notFound || entities.length === 0) ? (
                        <div style={{ textAlign: "center", padding: "64px 20px" }}>
                            <ChartBarIcon style={{ width: 40, height: 40, color: "var(--text-dim)", margin: "0 auto 20px" }} />
                            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No entity found</h2>
                            <p className="text-muted" style={{ maxWidth: 380, margin: "0 auto 28px" }}>
                                No entity was found registered to the targeted wallet address.
                            </p>
                            <Link href="/onboard" className="btn btn-primary">
                                Register an Exchange
                            </Link>
                        </div>
                    ) : (
                        <EntityTable entities={entities} loading={loading} />
                    )}
                </div>
            </div>
        </div>
    );
}
