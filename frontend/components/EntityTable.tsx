"use client";
import React, { useState } from "react";
import Link from "next/link";
import ProofStatusBadge from "./ProofStatusBadge";
import ReserveRatioBand from "./ReserveRatioBand";
import ProofCountdown from "./ProofCountdown";
import { formatRelativeTime } from "@/lib/starknet";
import { ChevronDownIcon, ChevronUpIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

export const AUTHORIZED_WALLETS = ["0x044bee7bb2e611f5d0d10026ec411bf0617ac9d58b640ff5587f2a163c117b6d"];

export interface EntityRow {
    id: string;
    name: string;
    status: "Active" | "Expired" | "NeverProven" | "Expiring";
    band: number;
    blockHeight: bigint | number;
    proofTimestamp: bigint | number;
    expiryTimestamp: bigint | number;
    submissionCount: number;
    registrant?: string;
}

interface Props {
    entities: EntityRow[];
    loading?: boolean;
}

export default function EntityTable({ entities, loading }: Props) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    if (loading) {
        return (
            <div className="card">
                <div style={{ padding: "32px", textAlign: "center" }}>
                    <div className="spinner" style={{ margin: "0 auto 12px" }} />
                    <p className="text-muted text-sm">Loading entities from Starknet...</p>
                </div>
            </div>
        );
    }

    if (entities.length === 0) {
        return (
            <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                    No entities registered yet.
                </p>
                <Link href="/onboard" className="btn btn-primary btn-sm">
                    Register & Submit Proof
                </Link>
            </div>
        );
    }

    // Group entities by both parent name AND the registering wallet to strictly prevent spoofing clusters
    const groups: Record<string, { parent: string, registrant: string, activeProofs: number, bands: Record<number, number>, children: EntityRow[] }> = {};

    entities.forEach(e => {
        const parts = e.name.split("|");
        const parentName = parts[0];
        const groupKey = `${parentName}_${e.registrant || "demo"}`;

        if (!groups[groupKey]) {
            groups[groupKey] = { parent: parentName, registrant: e.registrant || "", activeProofs: 0, bands: {}, children: [] };
        }
        groups[groupKey].children.push(e);
        if (e.status === "Active" || e.status === "Expiring") {
            groups[groupKey].activeProofs++;
            groups[groupKey].bands[e.band] = (groups[groupKey].bands[e.band] || 0) + 1;
        }
    });

    const toggleExpand = (groupKey: string) => {
        setExpanded(p => ({ ...p, [groupKey]: !p[groupKey] }));
    };

    return (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Entity Name</th>
                            <th>Status (Aggregated)</th>
                            <th>Proof Details</th>
                            <th>Assets Covered</th>
                            <th>Total Proofs Submitted</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(groups).map(([groupKey, g]) => {
                            const isExpanded = expanded[groupKey];
                            const hasMultiple = g.children.length > 1;

                            // Aggregation logic
                            const activeKids = g.children.filter(c => c.status === "Active" || c.status === "Expiring");
                            let aggStatus: "Active" | "Expired" | "NeverProven" | "Expiring" = "NeverProven";
                            if (activeKids.length === g.children.length) aggStatus = "Active";
                            else if (activeKids.length > 0) aggStatus = "Expiring"; // Partial
                            else if (g.children.some(c => c.status === "Expired")) aggStatus = "Expired";

                            const totalSubmits = g.children.reduce((acc, c) => acc + c.submissionCount, 0);

                            // Band breakdown string
                            const bandStrings = [];
                            if (g.bands[3]) bandStrings.push(`Band 3 in ${g.bands[3]} cases`);
                            if (g.bands[2]) bandStrings.push(`Band 2 in ${g.bands[2]} cases`);
                            if (g.bands[1]) bandStrings.push(`Band 1 in ${g.bands[1]} cases`);
                            const bandSummary = bandStrings.length ? bandStrings.join(", ") : "No active proofs";

                            return (
                                <React.Fragment key={groupKey}>
                                    {/* Parent Group Row (or only row if 1 child) */}
                                    {hasMultiple ? (
                                        <tr onClick={() => toggleExpand(groupKey)} className="clickable" style={{ background: "var(--surface-2)" }}>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    {isExpanded ? <ChevronUpIcon style={{ width: 14, height: 14, color: "var(--text-muted)" }} /> : <ChevronDownIcon style={{ width: 14, height: 14, color: "var(--text-muted)" }} />}
                                                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{g.parent}</span>
                                                    {g.registrant && AUTHORIZED_WALLETS.includes(g.registrant) && <CheckCircleIcon style={{ width: 14, height: 14, color: "var(--green)" }} title="Verified Authorized Wallet" />}
                                                </div>
                                            </td>
                                            <td><ProofStatusBadge status={aggStatus} /></td>
                                            <td><span className="text-muted text-sm">{bandSummary}</span></td>
                                            <td><span className="mono-sm text-dim">{g.children.length} assets</span></td>
                                            <td><span className="mono-sm text-muted">{totalSubmits}</span></td>
                                        </tr>
                                    ) : (
                                        // Single child row directly clickable to the entity page
                                        <tr className="clickable">
                                            <td>
                                                <Link href={`/entity/${g.children[0].id}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{g.parent}</span>
                                                        {g.registrant && AUTHORIZED_WALLETS.includes(g.registrant) && <CheckCircleIcon style={{ width: 14, height: 14, color: "var(--green)" }} title="Verified Authorized Wallet" />}
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                                        <span style={{ color: "var(--green)", fontWeight: 500, fontSize: 13 }}>{g.children[0].name.split("|")[1] || "BTC"}</span>
                                                        <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{g.children[0].name.split("|")[2] || "Bitcoin"}</span>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td><ProofStatusBadge status={aggStatus} /></td>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    {g.children[0].status === "NeverProven" ? <span className="text-muted">—</span> : <ReserveRatioBand band={g.children[0].band} size="sm" />}
                                                    <span className="mono-sm text-dim">Block #{Number(g.children[0].blockHeight).toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {g.children[0].status === "NeverProven" ? <span className="text-muted">—</span> : <span className="text-muted text-sm px-2">Proven {formatRelativeTime(g.children[0].proofTimestamp)}</span>}
                                            </td>
                                            <td><span className="mono-sm text-muted">{totalSubmits}</span></td>
                                        </tr>
                                    )}

                                    {/* Token-Specific Child Rows (Only show if multiple and expanded) */}
                                    {(isExpanded && hasMultiple) && g.children.map(c => {
                                        const parts = c.name.split("|");
                                        const tokenName = parts[1] || "BTC";
                                        const networkName = parts[2] || "Bitcoin";

                                        return (
                                            <tr key={c.id} style={{ background: "rgba(0,0,0,0.2)" }}>
                                                <td style={{ paddingLeft: 32 }}>
                                                    <Link href={`/entity/${c.id}`} style={{ display: "flex", flexDirection: "column", textDecoration: "none" }}>
                                                        <span style={{ color: "var(--green)", fontWeight: 500, fontSize: 13 }}>{tokenName}</span>
                                                        <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{networkName}</span>
                                                    </Link>
                                                </td>
                                                <td><ProofStatusBadge status={c.status} /></td>
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        {c.status === "NeverProven" ? <span className="text-muted">—</span> : <ReserveRatioBand band={c.band} size="sm" />}
                                                    </div>
                                                </td>
                                                <td>
                                                    {c.status === "NeverProven" ? <span className="text-muted">—</span> : <span className="text-muted text-sm px-2">Proven <span className="mono-sm text-dim">Block #{Number(c.blockHeight).toLocaleString()}</span></span>}
                                                </td>
                                                <td><span className="mono-sm text-muted">{c.submissionCount}</span></td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
