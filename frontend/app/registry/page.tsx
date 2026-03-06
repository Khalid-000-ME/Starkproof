"use client";
import { useEffect, useRef, useState } from "react";
import LiveBlockTicker from "@/components/LiveBlockTicker";
import EcosystemHealthBanner from "@/components/EcosystemHealthBanner";
import EntityTable, { AUTHORIZED_WALLETS } from "@/components/EntityTable";
import type { EntityRow } from "@/components/EntityTable";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

const ProofTimeline = dynamic(() => import("@/components/charts/ProofTimeline"), { ssr: false });
const RatioDistribution = dynamic(() => import("@/components/charts/RatioDistribution"), { ssr: false });

import { REGISTRY_ADDRESS, provider, feltToHash } from "@/lib/starknet";
import { hash } from "starknet";

const DEMO_ENTITIES: EntityRow[] = [
    {
        id: "0xkraken",
        name: "Kraken",
        status: "Active",
        band: 3,
        blockHeight: BigInt(880412),
        proofTimestamp: BigInt(Math.floor(Date.now() / 1000) - 7200),
        expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + 2419200),
        submissionCount: 12,
    },
    {
        id: "0xnexo",
        name: "Nexo",
        status: "Active",
        band: 2,
        blockHeight: BigInt(880001),
        proofTimestamp: BigInt(Math.floor(Date.now() / 1000) - 86400),
        expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + 2246400),
        submissionCount: 8,
    },
    {
        id: "0xmaple",
        name: "Maple Finance",
        status: "Expiring",
        band: 3,
        blockHeight: BigInt(878500),
        proofTimestamp: BigInt(Math.floor(Date.now() / 1000) - 2246400),
        expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + 172800),
        submissionCount: 3,
    },
];

export default function RegistryPage() {
    const [entities, setEntities] = useState<EntityRow[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const fetchRef = useRef<(() => Promise<void>) | null>(null);

    const [rawEvents, setRawEvents] = useState<any[]>([]);
    const [timeline, setTimeline] = useState("1m");
    const [showAuthorizedOnly, setShowAuthorizedOnly] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        async function aggregateRealStats() {
            try {
                if (!REGISTRY_ADDRESS || REGISTRY_ADDRESS === "0x0") return;

                const eventKey = hash.getSelectorFromName("ProofSubmitted");

                // Scan the last ~500k blocks to get deeper timeline history 
                const currentBlock = await provider.getBlockNumber();
                const fromBlock = Math.max(0, currentBlock - 500000);

                let allEvents: any[] = [];
                let continuationToken: string | undefined = undefined;

                do {
                    const eventsRes = await provider.getEvents({
                        from_block: { block_number: fromBlock },
                        address: REGISTRY_ADDRESS,
                        keys: [[eventKey]],
                        chunk_size: 100,
                        continuation_token: continuationToken
                    });

                    allEvents = allEvents.concat(eventsRes.events);
                    continuationToken = eventsRes.continuation_token;
                } while (continuationToken);

                setRawEvents(allEvents);

            } catch (err) {
                console.error("Failed to fetch historical stats:", err);
            }
        }

        aggregateRealStats();

        async function callContract(entrypoint: string, calldata: string[] = []): Promise<string[]> {
            return provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint, calldata });
        }

        function feltToName(hexFelt: string): string {
            let hex = BigInt(hexFelt).toString(16);
            if (hex.length % 2 !== 0) hex = "0" + hex;
            let decoded = "";
            for (let j = 0; j < hex.length; j += 2) {
                const code = parseInt(hex.slice(j, j + 2), 16);
                if (code > 0) decoded += String.fromCharCode(code);
            }
            return decoded.trim() || "Unknown";
        }

        async function fetchLiveEntities(forceRefresh = false) {
            try {
                if (!REGISTRY_ADDRESS || REGISTRY_ADDRESS === "0x0" || REGISTRY_ADDRESS === "") {
                    setEntities(DEMO_ENTITIES);
                    setLoading(false);
                    return;
                }
                const cached = sessionStorage.getItem("registry_entities_cache");
                const cacheTime = sessionStorage.getItem("registry_entities_cache_time");
                const now = Date.now();

                if (cached) {
                    const parsed = JSON.parse(cached).map((e: any) => ({
                        ...e,
                        blockHeight: BigInt(e.blockHeight),
                        proofTimestamp: BigInt(e.proofTimestamp),
                        expiryTimestamp: BigInt(e.expiryTimestamp)
                    }));
                    setEntities(parsed);
                    setLoading(false);
                    if (!forceRefresh) return;
                }

                const countRes = await callContract("get_entity_count");
                const count = Number(BigInt(countRes[0]));
                if (count === 0) { setEntities([]); setLoading(false); return; }

                const loaded: EntityRow[] = [];
                for (let i = 0; i < count; i++) {
                    try {
                        const idRes = await callContract("get_entity_id_at", [String(i)]);
                        const id = idRes[0];
                        const rec = await callContract("get_entity", [id]);
                        const nameStr = feltToName(rec[0]);
                        const prf = await callContract("get_proof_record", [id]);
                        const r_height = BigInt(prf[1]);
                        const r_band = Number(BigInt(prf[3]));
                        const r_timestamp = BigInt(prf[4]);
                        const r_is_valid = BigInt(prf[5]) !== 0n;
                        const r_expiry = BigInt(prf[6]);
                        const r_count = Number(BigInt(prf[7]));
                        const nowSec = BigInt(Math.floor(Date.now() / 1000));
                        const twoDays = BigInt(48 * 3600);
                        let status: "Active" | "Expired" | "NeverProven" | "Expiring" = "NeverProven";
                        if (!r_is_valid || r_timestamp === 0n) status = "NeverProven";
                        else if (r_expiry < nowSec) status = "Expired";
                        else if (r_expiry - nowSec < twoDays) status = "Expiring";
                        else status = "Active";

                        loaded.push({
                            id: feltToHash(id),
                            name: nameStr,
                            status,
                            band: r_band,
                            blockHeight: r_height,
                            proofTimestamp: r_timestamp,
                            expiryTimestamp: r_expiry,
                            submissionCount: r_count,
                            registrant: feltToHash(rec[2])
                        });
                    } catch (err) {
                        console.error("Error fetching entity:", err);
                    }
                }
                loaded.sort((a, b) => Number(b.proofTimestamp) - Number(a.proofTimestamp));

                sessionStorage.setItem("registry_entities_cache", JSON.stringify(loaded, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                ));
                sessionStorage.setItem("registry_entities_cache_time", now.toString());

                setEntities(loaded);
                setLoading(false);

                // Stats are computed during render
                // We leave setStats for historical events which are fetched separately

            } catch (error) {
                console.error("Failed to load entities:", error);
                setEntities(DEMO_ENTITIES);
                setLoading(false);
            }
        }

        fetchRef.current = () => fetchLiveEntities(true);
        fetchLiveEntities();
    }, []);

    useEffect(() => {
        if (!rawEvents.length) return;

        const nowSec = Math.floor(Date.now() / 1000);
        let buckets: { start: number, end: number, date: string, count: number }[] = [];

        const dNow = new Date();
        const startOfDay = new Date(dNow.getFullYear(), dNow.getMonth(), dNow.getDate()).getTime() / 1000;

        if (timeline === "today") {
            // Show today in 4-hour buckets
            buckets = Array.from({ length: 6 }, (_, i) => {
                const start = startOfDay + i * 14400; // 4 hours in seconds
                const d = new Date(start * 1000);
                return { start, end: start + 14400, date: `${d.getHours()}:00`, count: 0 };
            });
        } else if (timeline === "5d") {
            // Last 5 days, bucket by day
            buckets = Array.from({ length: 5 }, (_, i) => {
                const start = startOfDay - (4 - i) * 86400; // 24 hours
                const d = new Date(start * 1000);
                return { start, end: start + 86400, date: `${d.getDate()}/${d.getMonth() + 1}`, count: 0 };
            });
        } else if (timeline === "1w") {
            // Last 7 days, bucket by day
            buckets = Array.from({ length: 7 }, (_, i) => {
                const start = startOfDay - (6 - i) * 86400;
                const d = new Date(start * 1000);
                return { start, end: start + 86400, date: `${d.getDate()}/${d.getMonth() + 1}`, count: 0 };
            });
        } else if (timeline === "1m") {
            // Last 4 weeks, bucket by week back from today
            buckets = Array.from({ length: 4 }, (_, i) => {
                const start = startOfDay - (3 - i) * 604800;
                const d = new Date(start * 1000);
                return { start, end: start + 604800, date: `${d.getDate()}/${d.getMonth() + 1}`, count: 0 };
            });
        } else if (timeline === "2m") {
            // Last 8 weeks, bucket by week back from today
            buckets = Array.from({ length: 8 }, (_, i) => {
                const start = startOfDay - (7 - i) * 604800;
                const d = new Date(start * 1000);
                return { start, end: start + 604800, date: `${d.getDate()}/${d.getMonth() + 1}`, count: 0 };
            });
        }

        rawEvents.forEach(evt => {
            const ts = Number(BigInt(evt.data[2]));
            for (const b of buckets) {
                if (ts >= b.start && ts < b.end) {
                    b.count++;
                    break;
                }
            }
        });

        setStats((prev: any) => ({
            ...prev,
            proof_history_30d: buckets.map(b => ({ date: b.date, count: b.count }))
        }));
    }, [rawEvents, timeline]);

    // Filter & Sort Logic
    let displayedEntities = [...entities];

    // Sort logic to push unauthorized bottom
    displayedEntities.sort((a, b) => {
        const aAuth = a.registrant && AUTHORIZED_WALLETS.includes(a.registrant) ? 1 : 0;
        const bAuth = b.registrant && AUTHORIZED_WALLETS.includes(b.registrant) ? 1 : 0;
        if (aAuth !== bAuth) return bAuth - aAuth; // Authorized first
        return Number(b.proofTimestamp) - Number(a.proofTimestamp);
    });

    if (showAuthorizedOnly) {
        displayedEntities = displayedEntities.filter(e => e.registrant && AUTHORIZED_WALLETS.includes(e.registrant));
    }

    if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        displayedEntities = displayedEntities.filter(e =>
            e.name.toLowerCase().includes(query) || e.id.toLowerCase().includes(query)
        );
    }

    const valid = displayedEntities.filter((e) => e.status === "Active" || e.status === "Expiring").length;
    const expired = displayedEntities.filter((e) => e.status === "Expired").length;
    const never = displayedEntities.filter((e) => e.status === "NeverProven").length;

    // Derived realtime stats
    const totalProofsComputed = displayedEntities.reduce((sum, e) => sum + e.submissionCount, 0);
    const bandDistComputed = { 1: 0, 2: 0, 3: 0 };
    let validBandCountComputed = 0;
    displayedEntities.forEach(e => {
        if (e.status === "Active" || e.status === "Expiring") {
            bandDistComputed[e.band as keyof typeof bandDistComputed]++;
            validBandCountComputed++;
        }
    });
    const avgBandComputed = validBandCountComputed > 0
        ? Number(Object.entries(bandDistComputed).reduce((a, b) => bandDistComputed[a[0] as unknown as keyof typeof bandDistComputed] > b[1] ? a : b)[0])
        : null;

    return (
        <>
            <div className="page">
                <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
                                Proof of Reserves Registry
                            </h1>
                            <p className="text-muted mt-1">
                                Real-time solvency status for registered entities  ·  Starknet Sepolia
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={async () => {
                                    if (fetchRef.current) {
                                        setRefreshing(true);
                                        await fetchRef.current();
                                        setRefreshing(false);
                                    }
                                }}
                                disabled={refreshing}
                                title="Refresh from Starknet"
                            >
                                <ArrowPathIcon style={{ width: 14, height: 14 }} />
                                {refreshing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "Refresh"}
                            </button>
                            <Link href="/onboard" className="btn btn-primary btn-sm">
                                Register Exchange
                            </Link>
                        </div>
                    </div>

                    <EcosystemHealthBanner
                        total={displayedEntities.length}
                        valid={valid}
                        expired={expired}
                        neverProven={never}
                        nextExpiryDays={2}
                    />

                    <div className="stats-row mt-4">
                        <div className="stat-cell">
                            <div className="stat-label">Total Proofs</div>
                            <div className="stat-value">{totalProofsComputed > 0 ? totalProofsComputed : "—"}</div>
                        </div>
                        <div className="stat-cell">
                            <div className="stat-label">Avg Reserve Band</div>
                            <div className="stat-value" style={{ color: "var(--green)" }}>
                                {avgBandComputed === 3 ? "≥ 120%" :
                                    avgBandComputed === 2 ? "110–120%" :
                                        avgBandComputed === 1 ? "100–110%" : "—"}
                            </div>
                        </div>
                        <div className="stat-cell">
                            <div className="stat-label">Entities Registered</div>
                            <div className="stat-value">{loading ? "—" : displayedEntities.length}</div>
                        </div>
                        <div className="stat-cell">
                            <div className="stat-label">Validity Rate</div>
                            <div className="stat-value" style={{ color: "var(--green)" }}>
                                {displayedEntities.length > 0 ? Math.round((valid / displayedEntities.length) * 100) : 0}%
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px", marginTop: "48px", alignItems: "start" }}>
                        <div>
                            <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div className="section-title">Registered Entities</div>
                                    <div className="section-desc">Click any row to view proof history</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    <div style={{ position: "relative" }}>
                                        <MagnifyingGlassIcon style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--text-muted)" }} />
                                        <input
                                            type="text"
                                            placeholder="Search Exchange / ID..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            style={{
                                                background: "var(--surface)",
                                                border: "1px solid var(--border)",
                                                color: "var(--text)",
                                                fontSize: 13,
                                                padding: "6px 12px 6px 30px",
                                                borderRadius: "var(--radius)",
                                                outline: "none",
                                                minWidth: "220px",
                                            }}
                                        />
                                    </div>
                                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text)" }}>
                                        <input
                                            type="checkbox"
                                            checked={showAuthorizedOnly}
                                            onChange={e => setShowAuthorizedOnly(e.target.checked)}
                                            className="custom-checkbox"
                                        />
                                        Authorized only
                                    </label>
                                </div>
                            </div>
                            <EntityTable entities={displayedEntities} loading={loading} />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column" }}>
                                <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 0 }}>
                                    <div>
                                        <div className="section-title">Proof Submissions</div>
                                    </div>
                                    <select
                                        value={timeline}
                                        onChange={(e) => setTimeline(e.target.value)}
                                        style={{
                                            background: "var(--surface)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-muted)",
                                            fontSize: 12,
                                            padding: "4px 8px",
                                            borderRadius: "var(--radius)",
                                            outline: "none",
                                            cursor: "pointer",
                                            marginLeft: "auto"
                                        }}
                                    >
                                        <option value="today">Today</option>
                                        <option value="5d">Last 5 days</option>
                                        <option value="1w">This week</option>
                                        <option value="1m">This month</option>
                                        <option value="2m">Last 2 months</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1, minHeight: 180, marginTop: 16 }}>
                                    <ProofTimeline data={stats?.proof_history_30d ?? []} />
                                </div>
                            </div>
                            <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column" }}>
                                <div className="section-header">
                                    <div className="section-title">Reserve Band Distribution</div>
                                    <div className="section-desc">Active proofs only</div>
                                </div>
                                <div style={{ flex: 1, minHeight: 180, marginTop: 16 }}>
                                    <RatioDistribution data={[
                                        { band: 1, count: bandDistComputed[1] },
                                        { band: 2, count: bandDistComputed[2] },
                                        { band: 3, count: bandDistComputed[3] }
                                    ]} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
