"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
    ShieldCheckIcon,
    LockClosedIcon,
    ChartBarIcon,
    ClockIcon,
    ArrowRightIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";

import { provider, REGISTRY_ADDRESS } from "@/lib/starknet";
import Grainient from "@/components/Grainient";

export default function LandingPage() {
    const [totalSubmissions, setTotalSubmissions] = useState<number | null>(null);
    const [entityCount, setEntityCount] = useState<number | null>(null);

    useEffect(() => {
        async function fetchLiveStats() {
            try {
                if (!REGISTRY_ADDRESS || REGISTRY_ADDRESS === "0x0") return;

                const countRes = await provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint: "get_entity_count", calldata: [] });
                setEntityCount(Number(BigInt(countRes[0])));

                const subsRes = await provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint: "get_total_submissions", calldata: [] });
                setTotalSubmissions(Number(BigInt(subsRes[0])));
            } catch (err) {
                console.error("Failed to load live stats on landing:", err);
            }
        }

        fetchLiveStats();
        const int = setInterval(fetchLiveStats, 30_000);
        return () => clearInterval(int);
    }, []);

    const steps = [
        {
            num: "01",
            icon: LockClosedIcon,
            title: "Connect and Register",
            desc: "Connect your Braavos wallet to Starknet Sepolia. Enter your exchange name — your entity identity is derived cryptographically from your name and wallet address.",
        },
        {
            num: "02",
            icon: ChartBarIcon,
            title: "Run the ZK Circuit",
            desc: "Add your Bitcoin (or other token) cold wallet addresses. Upload your customer liability CSV. The zero-knowledge circuit runs entirely in your browser — your balances and customer data never leave your machine.",
        },
        {
            num: "03",
            icon: ShieldCheckIcon,
            title: "Submit to Starknet",
            desc: "Sign one transaction. Your proof commitment and public inputs are stored permanently on Starknet. Anyone can verify your solvency without learning your balances.",
        },
        {
            num: "04",
            icon: ClockIcon,
            title: "Renew Every 28 Days",
            desc: "Proofs expire after 28 days. Your dashboard shows a countdown and alerts you before expiry. Renewal takes under two minutes for returning operators.",
        },
    ];

    const guarantees = [
        { label: "No balance exposed", desc: "Wallet addresses and exact holdings stay in your browser" },
        { label: "No customer data on-chain", desc: "Only the Merkle root commitment is published" },
        { label: "Mathematically unforgeable", desc: "An insolvent entity cannot produce a valid proof" },
        { label: "Permanent record", desc: "Starknet stores every proof submission immutably" },
    ];

    return (
        <div className="page" style={{ paddingTop: 0 }}>
            {/* ── Hero ────────────────────────────────────────────────────── */}
            <section style={{
                position: "relative",
                paddingTop: 160,
                paddingBottom: 80,
                borderBottom: "1px solid var(--border-subtle)",
            }}>
                {/* Grainient Background Effect */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 0,
                    opacity: 0.25,
                    maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)"
                }}>
                    <Grainient
                        timeSpeed={0.15}
                        color1="#06b6d4"   /* Cyan accent */
                        color2="#10b981"   /* Green accent */
                        color3="#0a0a0a"   /* Dark background */
                        warpStrength={2.0}
                        zoom={1.2}
                    />
                </div>

                <div className="container" style={{ position: "relative", zIndex: 1 }}>
                    {/* Title Block */}
                    <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
                        <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
                            <img src="/logo.png" alt="zkReserves" style={{ width: 80, height: 80, borderRadius: 16, boxShadow: "0 8px 24px rgba(16, 185, 129, 0.2)" }} />
                        </div>
                        <h1 style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: "clamp(48px, 7vw, 76px)",
                            fontWeight: 400,
                            letterSpacing: "-0.03em",
                            lineHeight: 1.05,
                            marginBottom: 24,
                            color: "var(--text)"
                        }}>
                            Prove solvency.<br />
                            <em style={{ fontStyle: "italic", fontWeight: 500, color: "var(--accent)" }}>Reveal nothing.</em>
                        </h1>
                        <p style={{
                            fontSize: 17,
                            color: "var(--text-muted)",
                            lineHeight: 1.6,
                            marginBottom: 40,
                            maxWidth: 580,
                            margin: "0 auto 40px",
                            fontFamily: "var(--font)"
                        }}>
                            zkReserves lets any Bitcoin (or other digital asset) custodian cryptographically prove their reserves exceed liabilities — without exposing wallet addresses, exact balances, or customer data.
                        </p>

                        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 72 }}>
                            <Link href="/onboard" className="btn btn-primary btn-lg" style={{ padding: "12px 28px", fontSize: 15, borderRadius: 32 }}>
                                Register Your Exchange
                                <ArrowRightIcon style={{ width: 16, height: 16, marginLeft: 4 }} />
                            </Link>
                            <Link href="/registry" className="btn btn-secondary btn-lg" style={{ padding: "12px 28px", fontSize: 15, borderRadius: 32 }}>
                                View Live Registry
                            </Link>
                        </div>

                    </div>

                    {/* Image / Card Blocks mimicking the structure of the reference */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 24,
                        maxWidth: 1000,
                        margin: "0 auto"
                    }}>
                        {/* Left Card */}
                        <div style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 24,
                            padding: 32,
                            minHeight: 340,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            boxShadow: "var(--shadow-md)"
                        }}>
                            <div>
                                <h3 style={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontSize: 32,
                                    fontWeight: 400,
                                    lineHeight: 1.2,
                                    marginBottom: 12
                                }}>
                                    Live network <br /> <em style={{ color: "var(--accent-secondary)" }}>Metrics</em>
                                </h3>
                                <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
                                    Total verified volume secured across our cryptographically sealed Starknet circuits.
                                </p>
                            </div>
                            <div>
                                <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)", fontFamily: "var(--font)" }}>
                                    {totalSubmissions !== null ? totalSubmissions : "—"}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Total Proofs Submitted</div>
                            </div>
                        </div>

                        {/* Right Card */}
                        <div style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 24,
                            padding: 32,
                            minHeight: 340,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            position: "relative",
                            overflow: "hidden",
                            backdropFilter: "var(--glass-blur)",
                            WebkitBackdropFilter: "var(--glass-blur)",
                            boxShadow: "var(--shadow-md)"
                        }}>
                            {/* Decorative background element for the right card to mimic the dark image */}
                            <div style={{
                                position: "absolute",
                                right: -40,
                                bottom: -40,
                                width: 200,
                                height: 200,
                                background: "var(--accent)",
                                filter: "blur(100px)",
                                opacity: 0.15,
                                borderRadius: "50%"
                            }} />
                            <div style={{ position: "relative", zIndex: 1, alignSelf: "flex-end", background: "var(--surface-2)", border: "1px solid var(--border)", padding: "12px 16px", borderRadius: 12 }}>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>Validity: 28 Days</div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Auto-renewable cycle</div>
                            </div>
                            <div style={{ position: "relative", zIndex: 1, marginTop: "auto" }}>
                                <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)", fontFamily: "var(--font)" }}>
                                    {entityCount !== null ? entityCount : "—"}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Registered Entities</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── How It Works ─────────────────────────────────────────────── */}
            <section style={{ padding: "96px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="container">
                    <div style={{ textAlign: "center", marginBottom: 56 }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Process</div>
                        <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>How it works</h2>
                        <p className="text-muted" style={{ marginTop: 8, fontSize: 14 }}>Four steps from registration to live solvency status</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 2, background: "var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                        {steps.map(({ num, icon: Icon, title, desc }) => (
                            <div key={num} style={{ background: "var(--surface)", padding: "28px 24px" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: "var(--radius)",
                                        background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                    }}>
                                        <Icon style={{ width: 18, height: 18, color: "var(--accent)" }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)", paddingTop: 10 }}>{num}</div>
                                </div>
                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{title}</div>
                                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65 }}>{desc}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ textAlign: "center", marginTop: 36 }}>
                        <Link href="/onboard" className="btn btn-primary">
                            Start Registration
                            <ArrowRightIcon style={{ width: 14, height: 14 }} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── What We Guarantee ─────────────────────────────────────────── */}
            <section style={{ padding: "96px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="container">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Security Model</div>
                            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>What the protocol guarantees</h2>
                            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
                                The zero-knowledge circuit makes mathematical guarantees that no amount of trust or auditing can match. These properties hold regardless of whether you trust this frontend, the zkReserves team, or the exchange itself.
                            </p>
                            <div style={{ marginTop: 28 }}>
                                <Link href="/verify" className="btn btn-secondary btn-sm">
                                    Independent Verification Tool
                                </Link>
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {guarantees.map((g) => (
                                <div key={g.label} style={{
                                    display: "flex", gap: 14, alignItems: "flex-start",
                                    background: "var(--surface)", border: "1px solid var(--border)",
                                    borderRadius: "var(--radius)", padding: "14px 16px",
                                }}>
                                    <CheckCircleIcon style={{ width: 18, height: 18, color: "var(--green)", flexShrink: 0, marginTop: 1 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{g.label}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Reserve Ratio Bands ────────────────────────────────────────── */}
            <section style={{ padding: "96px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="container">
                    <div style={{ textAlign: "center", marginBottom: 48 }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Classification</div>
                        <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Reserve ratio bands</h2>
                        <p className="text-muted" style={{ marginTop: 8, fontSize: 14 }}>The circuit classifies proof results into four bands. The band is public — exact reserves are not.</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, background: "var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", maxWidth: 800, margin: "0 auto" }}>
                        {[
                            { band: "Band 0", range: "< 100%", label: "Insolvent", color: "var(--red)", note: "Circuit fails. No proof possible." },
                            { band: "Band 1", range: "100 – 110%", label: "Solvent", color: "var(--yellow)", note: "Minimum viable. Warning threshold." },
                            { band: "Band 2", range: "110 – 120%", label: "Comfortable", color: "var(--green)", note: "Acceptable buffer." },
                            { band: "Band 3", range: ">= 120%", label: "Strong", color: "var(--green)", note: "Overcollateralized. Preferred." },
                        ].map((b) => (
                            <div key={b.band} style={{ background: "var(--surface)", padding: "24px 20px" }}>
                                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 8 }}>{b.band}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: b.color, marginBottom: 4 }}>{b.range}</div>
                                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>{b.label}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{b.note}</div>
                                <div style={{ height: 3, background: b.color === "var(--red)" ? "var(--border)" : b.color, borderRadius: 2, marginTop: 12, opacity: b.band === "Band 0" ? 0.3 : 1 }} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Bottom CTA ────────────────────────────────────────────────── */}
            <section style={{ padding: "96px 0" }}>
                <div className="container" style={{ textAlign: "center" }}>
                    <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
                        Ready to prove solvency?
                    </h2>
                    <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 32, maxWidth: 400, margin: "0 auto 32px" }}>
                        Registration takes under five minutes. Your first proof submission proves solvency permanently on Starknet.
                    </p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        <Link href="/onboard" className="btn btn-primary btn-lg">
                            Register Your Exchange
                            <ArrowRightIcon style={{ width: 16, height: 16 }} />
                        </Link>
                        <Link href="/registry" className="btn btn-secondary btn-lg">
                            Browse Registry
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "24px 0" }}>
                <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        zkReserves · Re{"{"}define{"}"} Hackathon · Privacy & Bitcoin (Multi-Token) on Starknet
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                        {[
                            { href: "/registry", label: "Registry" },
                            { href: "/verify", label: "Verify" },
                            { href: "/docs", label: "Docs" },
                        ].map((l) => (
                            <Link key={l.href} href={l.href} style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {l.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
}
