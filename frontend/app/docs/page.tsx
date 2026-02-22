import Link from "next/link";

export default function DocsPage() {
    return (
        <div className="page">
            <div className="container-narrow" style={{ paddingTop: 32, paddingBottom: 64 }}>
                <div style={{ marginBottom: 32 }}>
                    <div className="badge badge-orange mb-3">Privacy + Bitcoin · Starknet</div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 12 }}>
                        How Starkproof Works
                    </h1>
                    <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8 }}>
                        A trustless, privacy-preserving Proof of Reserves protocol on Starknet.
                        Prove solvency without revealing wallet addresses, exact balances, or any identifying information.
                    </p>
                </div>

                {/* Problem */}
                <div className="card mb-4">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", letterSpacing: "0.08em", marginBottom: 12 }}>THE PROBLEM</div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>The Transparency-Security Dilemma</h2>
                    <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-muted)" }}>
                        After FTX collapsed in November 2022, the crypto industry adopted Proof of Reserves as a standard.
                        But the dominant approach — Merkle proofs + on-chain wallet attestations — creates a critical secondary problem:
                    </p>
                    <div className="card mt-3" style={{ background: "var(--surface-2)", borderColor: "var(--red-dim)" }}>
                        <strong style={{ color: "var(--red)" }}>Publishing PoR today means exposing your entire treasury to the world.</strong>
                        <ul style={{ paddingLeft: 20, marginTop: 8, color: "var(--text-muted)", fontSize: 13, lineHeight: 2 }}>
                            <li>Exact Bitcoin wallet addresses</li>
                            <li>Total BTC holdings down to the satoshi</li>
                            <li>When and how the treasury moves</li>
                            <li>Which wallets are hot vs. cold</li>
                        </ul>
                    </div>
                </div>

                {/* Solution */}
                <div className="card mb-4">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", letterSpacing: "0.08em", marginBottom: 12 }}>THE SOLUTION</div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Zero-Knowledge Proof of Reserves</h2>
                    <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-muted)" }}>
                        Starkproof uses STARK proofs to let any entity prove:
                    </p>
                    <div className="code-block mt-3 mb-3">
                        {`∃ (wallet_addresses, balances, liabilities) such that:
  sum(balances) ≥ sum(liabilities)
  AND merkle_root(liabilities) == published_commitment`}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        ...and the verifier learns <strong>nothing</strong> except that this statement is true.
                    </p>
                </div>

                {/* What's public vs private */}
                <div className="card mb-4">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 12 }}>DATA MODEL</div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>What's Public vs. Private</h2>
                    <div className="grid-2" style={{ gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", letterSpacing: "0.06em", marginBottom: 8 }}>PUBLIC (on-chain)</div>
                            <div className="card card-tight" style={{ background: "var(--surface-2)" }}>
                                <ul style={{ fontSize: 12, lineHeight: 2, color: "var(--text-muted)", listStyle: "none" }}>
                                    <li>✓ Reserve ratio band (100–110%, 110–120%, ≥120%)</li>
                                    <li>✓ BTC block height at time of proof</li>
                                    <li>✓ Liability Merkle root (commitment hash)</li>
                                    <li>✓ Proof timestamp and expiry</li>
                                    <li>✓ Entity identifier hash</li>
                                </ul>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", letterSpacing: "0.06em", marginBottom: 8 }}>PRIVATE (never revealed)</div>
                            <div className="card card-tight" style={{ background: "var(--surface-2)" }}>
                                <ul style={{ fontSize: 12, lineHeight: 2, color: "var(--text-muted)", listStyle: "none" }}>
                                    <li>✗ Bitcoin wallet addresses</li>
                                    <li>✗ Exact BTC balances</li>
                                    <li>✗ Exact reserve ratio</li>
                                    <li>✗ Customer identities</li>
                                    <li>✗ Individual liability amounts</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Circuit */}
                <div className="card mb-4">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--purple)", letterSpacing: "0.08em", marginBottom: 12 }}>CIRCUIT LOGIC</div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>The Cairo Circuit</h2>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                        The circuit enforces these constraints. If any fails, no valid proof can be generated:
                    </p>
                    <div className="code-block">
                        {`1. Assert total_reserves > 0
2. Assert total_liabilities > 0
3. Assert total_reserves >= total_liabilities  // ← THE CORE ASSERTION
4. Compute liability_merkle_root = Poseidon-Merkle(account_ids, liabilities)
5. Compute reserve_ratio_band from ratio
6. Output: (liability_merkle_root, reserve_ratio_band)`}
                    </div>
                    <p className="text-muted text-sm mt-3">
                        The Merkle tree uses Poseidon hash — Cairo-native and gas-efficient. The entity cannot change a single customer's liability after publishing the root.
                    </p>
                </div>

                {/* Reserve Bands */}
                <div className="card mb-4">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.08em", marginBottom: 12 }}>PRIVACY DESIGN</div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Why Bands Instead of Exact Ratios?</h2>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.8 }}>
                        Rather than revealing the exact ratio (e.g., 1.34), the circuit outputs a band (e.g., "between 120% and ∞").
                        This gives users meaningful information about safety margins while preventing treasury reconstruction
                        from ratio + liability count.
                    </p>
                    <div className="mt-3" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                            { band: 1, label: "100–110%", color: "var(--yellow)", desc: "Minimum reserve — cautious" },
                            { band: 2, label: "110–120%", color: "var(--green)", desc: "Comfortable reserve buffer" },
                            { band: 3, label: "≥ 120%", color: "var(--green)", desc: "Strong overcollateralization" },
                        ].map(({ band, label, color, desc }) => (
                            <div key={band} className="flex items-center gap-3">
                                <div style={{ width: 80, height: 20, background: color, opacity: 0.15, borderRadius: 4, position: "relative" }}>
                                    <div style={{ position: "absolute", inset: 0, background: color, borderRadius: 4, opacity: band !== 1 ? 0.6 : 0.3, width: band === 1 ? "40%" : band === 2 ? "70%" : "100%" }} />
                                </div>
                                <span style={{ fontSize: 12, fontFamily: "var(--mono)", color, minWidth: 80 }}>{label}</span>
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FAQ */}
                <div className="card mb-4">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 16 }}>FAQ</div>
                    {[
                        {
                            q: "Can an insolvent entity fake a proof?",
                            a: "No. The circuit assertion total_reserves ≥ total_liabilities will fail if reserves are insufficient. No valid proof can be produced for a false statement. This is the mathematical guarantee of STARKs."
                        },
                        {
                            q: "Can the entity change their liability data after submitting?",
                            a: "No. The liability_merkle_root binds all customer liabilities at proof time. Changing a single account's balance would produce a different root, invalidating the proof."
                        },
                        {
                            q: "Does this prove the entity disclosed ALL their liabilities?",
                            a: "No. The circuit proves the Merkle root is correctly computed from the DISCLOSED liability set. An entity cannot add undisclosed liabilities without invalidating the root. This is the same limitation as all self-reported PoR systems."
                        },
                        {
                            q: "How often must entities re-prove?",
                            a: "Proofs expire after 30 days. Entities must submit a new proof to maintain active status. This prevents stale attestations from being presented as current."
                        },
                    ].map(({ q, a }) => (
                        <div key={q} style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 16, marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{q}</div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>{a}</div>
                        </div>
                    ))}
                </div>

                {/* Links */}
                <div className="card">
                    <div className="section-title mb-3">Resources</div>
                    <div className="flex gap-3 flex-wrap">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">GitHub Repository</a>
                        <Link href="/verify" className="btn btn-secondary btn-sm">Verification Tool</Link>
                        <Link href="/prove" className="btn btn-primary btn-sm">Submit a Proof</Link>
                        <a href="https://sepolia.voyager.online" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Starkscan Explorer</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
