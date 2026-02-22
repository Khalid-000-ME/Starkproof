"use client";
import { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSendTransaction } from "@starknet-react/core";
import { computeEntityId, computeLiabilityRoot } from "@/lib/merkle";
import { satoshiToBTC, getMultipleBalances, getCurrentBlockHeight } from "@/lib/xverse";
import { generateProof, type ProofGenerationProgress } from "@/lib/circuit";
import { REGISTRY_ADDRESS, provider, feltToHash } from "@/lib/starknet";
import { TokenBTC, TokenETH, TokenUSDC, TokenSOL } from "@web3icons/react";
import Link from "next/link";
import {
    WalletIcon,
    CurrencyDollarIcon,
    TableCellsIcon,
    CpuChipIcon,
    CheckCircleIcon,
    ChevronRightIcon,
    ArrowUpTrayIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

const getTokenIcon = (symbol: string) => {
    switch (symbol.toUpperCase()) {
        case "BTC": return <TokenBTC size={22} />;
        case "ETH": return <TokenETH size={22} />;
        case "USDC": return <TokenUSDC size={22} />;
        case "SOL": return <TokenSOL size={22} />;
        default: return <CurrencyDollarIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />;
    }
};

type Step = 1 | 2 | 3 | 4;

const DEMO_SCENARIO = {
    addressEntries: [{ address: "tb1qax7ynrp5f84g9frfnm6lpatqmhf2hmlhd0guvz", network: "bitcoin" }],
    liabilityCsv: `account_id,liability\n0x05d985a6eabf7b1df25e01bcdfbaedce38b4d8349141be36d2460668b577a493,20000\n0x018b32087508cf31c463b28ee55ac7bbaec7fd3bc65c92c97f48ff3cbec8a1ce,30000\n0x067edebc6dbf6aa1a3ee7c10b14c1941ee04bbceca8d89e4c19fed93de146b2b,15000\n0x021b32087508cf31c463b28ee55ac7bbaec7fd3bc65c92c97f48ff3cbec8a1d1,12000\n0x032b32087508cf31c463b28ee55ac7bbaec7fd3bc65c92c97f48ff3cbec8a1e2,8000`,
};

const STEP_META = [
    { num: 1 as Step, label: "Reserves", icon: CurrencyDollarIcon },
    { num: 2 as Step, label: "Liabilities", icon: TableCellsIcon },
    { num: 3 as Step, label: "Prove", icon: CpuChipIcon },
    { num: 4 as Step, label: "Submit", icon: CheckCircleIcon },
];

export default function ProvePage() {
    const { address: walletAddress, isConnected, account } = useAccount();
    const { connect, connectors, isPending: isConnecting } = useConnect();
    const { disconnect } = useDisconnect();
    const { sendAsync: sendTransaction } = useSendTransaction({ calls: [] });

    const [loadingEntity, setLoadingEntity] = useState(true);
    const [entityInfo, setEntityInfo] = useState<{ id: string, nameHash: string } | null>(null);

    const [step, setStep] = useState<Step>(1);
    const [addressEntries, setAddressEntries] = useState([{ address: "", network: "ethereum_sepolia" }]);
    const [assetType, setAssetType] = useState("BTC");
    const [balances, setBalances] = useState<any[]>([]);
    const [blockHeight, setBlockHeight] = useState<number>(0);
    const [csvContent, setCsvContent] = useState("");
    const [proof, setProof] = useState<any>(null);
    const [progressSteps, setProgressSteps] = useState<ProofGenerationProgress[]>([]);
    const [loading, setLoading] = useState(false);
    const [targetWallet, setTargetWallet] = useState<string>("");
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const uniqueConnectors = connectors.filter((c, idx, arr) => arr.findIndex(x => x.id === c.id) === idx);

    useEffect(() => {
        if (!walletAddress) {
            setLoadingEntity(false);
            return;
        }
        if (!targetWallet && walletAddress) {
            setTargetWallet(walletAddress);
        }
    }, [walletAddress]);

    // ── Lookup Entity ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!targetWallet) return;

        async function findEntity() {
            setLoadingEntity(true);
            try {
                const countRes = await provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint: "get_entity_count" });
                const count = Number(BigInt(countRes[0]));

                for (let i = 0; i < count; i++) {
                    const idRes = await provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint: "get_entity_id_at", calldata: [String(i)] });
                    const id = idRes[0];
                    const rec = await provider.callContract({ contractAddress: REGISTRY_ADDRESS, entrypoint: "get_entity", calldata: [id] });

                    if (rec[2]?.toLowerCase() === targetWallet?.toLowerCase() || feltToHash(rec[2]) === feltToHash(targetWallet || "")) {
                        setEntityInfo({ id: "0x" + BigInt(id).toString(16), nameHash: rec[0] });
                        setLoadingEntity(false);
                        return;
                    }
                }
                setEntityInfo(null);
            } catch (e) {
                console.error(e);
            }
            setLoadingEntity(false);
        }

        findEntity();
    }, [targetWallet]);

    // ── Pre-fill addresses from local storage if returning ────────────────
    useEffect(() => {
        if (entityInfo) {
            const saved = localStorage.getItem(`address_entries_${entityInfo.id}`);
            if (saved) setAddressEntries(JSON.parse(saved));
        }
    }, [entityInfo]);

    // ── Step 1: Fetch Balances ─────────────────────────────────────────────
    async function handleFetchBalances() {
        const entries = addressEntries.filter(e => e.address.trim() !== "");
        if (entries.length === 0) { setError("Enter at least one wallet address"); return; }
        setError("");
        setLoading(true);
        try {
            if (assetType === "BTC") {
                const btcEntries = entries.map(e => ({ address: e.address.trim(), network: e.network }));

                // Get balances
                const bals = await getMultipleBalances(btcEntries);

                // Get block height from the "most mainnet-like" network in the batch
                // Fallback: Testnet < Signet < Bitcoin
                let bestNetwork = "testnet4";
                if (btcEntries.some(e => e.network === "bitcoin")) bestNetwork = "bitcoin";
                else if (btcEntries.some(e => e.network === "signet")) bestNetwork = "signet";
                else if (btcEntries.some(e => e.network === "testnet")) bestNetwork = "testnet";

                const height = await getCurrentBlockHeight(bestNetwork);

                setBalances(bals);
                setBlockHeight(height);
            } else if (assetType === "ETH" || assetType === "USDC") {
                // Fetch real balances via ethers using pure public RPCs
                const { ethers } = await import("ethers");

                const rpcs: Record<string, string> = {
                    base_sepolia: "https://sepolia.base.org",
                    arbitrum_sepolia: "https://sepolia-rollup.arbitrum.io/rpc",
                    ethereum_sepolia: "https://ethereum-sepolia-rpc.publicnode.com"
                };

                const usdcContracts: Record<string, string> = {
                    base_sepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                    arbitrum_sepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
                    ethereum_sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
                };

                let realBalances = [];
                let maxBlockHeight = 0;

                for (const entry of entries) {
                    const provider = new ethers.providers.JsonRpcProvider(rpcs[entry.network]);
                    const currentBlock = await provider.getBlockNumber();
                    if (currentBlock > maxBlockHeight) maxBlockHeight = currentBlock;

                    if (assetType === "ETH") {
                        const bal = await provider.getBalance(entry.address);
                        const num = Number(ethers.utils.formatEther(bal));
                        realBalances.push({ address: entry.address, balance: Math.floor(num * 100000000), satoshi: Math.floor(num * 100000000) });
                    } else if (assetType === "USDC") {
                        const abi = ["function balanceOf(address owner) view returns (uint256)"];
                        const contract = new ethers.Contract(usdcContracts[entry.network], abi, provider);
                        const bal = await contract.balanceOf(entry.address);
                        const num = Number(ethers.utils.formatUnits(bal, 6));
                        realBalances.push({ address: entry.address, balance: Math.floor(num * 100000000), satoshi: Math.floor(num * 100000000) });
                    }
                }

                setBlockHeight(maxBlockHeight);
                setBalances(realBalances);
            } else {
                const addrs = entries.map(e => e.address.trim());
                await new Promise(r => setTimeout(r, 1200));
                const mockBalances = addrs.map((addr) => ({
                    address: addr,
                    balance: Math.floor(Math.random() * 500000000000) + 1000000000,
                    satoshi: Math.floor(Math.random() * 500000000000) + 1000000000,
                }));
                const mockBlockHeight = assetType === "SOL" ? 250000000 : 19200000 + Math.floor(Math.random() * 1000);
                setBlockHeight(mockBlockHeight);
                setBalances(mockBalances);
            }
            if (entityInfo) localStorage.setItem(`address_entries_${entityInfo.id}`, JSON.stringify(addressEntries));
            setStep(2);
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to fetch balances across networks");
        } finally {
            setLoading(false);
        }
    }

    // ── Step 2: Upload liability CSV ───────────────────────────────────────────
    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setCsvContent((ev.target?.result as string) || "");
        reader.readAsText(file);
    }

    // ── Step 3: Run ZK circuit ─────────────────────────────────────────────────
    async function handleRunCircuit() {
        if (!csvContent.trim()) { setError("Upload or paste your liability CSV"); return; }
        const addrs = addressEntries.filter(e => e.address.trim() !== "").map(a => a.address.trim());
        setError("");
        setLoading(true);
        setProgressSteps([]);
        try {
            const result = await generateProof(
                {
                    entityId: entityInfo!.id,
                    walletAddresses: addrs,
                    walletBalances: balances.map(b => b.balance ?? b.satoshi ?? 0),
                    liabilitiesCSV: csvContent,
                    btcBlockHeight: blockHeight,
                },
                (steps: ProofGenerationProgress[]) => setProgressSteps(steps)
            );

            // Log to server so it appears in the backend terminal for auditor verification
            try {
                await fetch("/api/proof/log", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(result)
                });
            } catch (err) {
                console.error("Failed to log proof to server:", err);
            }

            setProof(result);
            setStep(4);
        } catch (e: any) {
            setError(e.message || "Circuit generation failed");
        } finally {
            setLoading(false);
        }
    }

    // ── Step 4: Submit ─────────────────────────────────────────────────────────
    async function handleSubmit() {
        if (!proof || !account || !entityInfo) return;
        setError("");
        setLoading(true);
        try {
            const calls = [
                {
                    contractAddress: REGISTRY_ADDRESS,
                    entrypoint: "submit_proof",
                    calldata: [
                        proof.publicInputs.entityId,
                        proof.publicInputs.entityId,
                        proof.publicInputs.blockHeight.toString(),
                        proof.publicInputs.liabilityMerkleRoot,
                        proof.publicInputs.reserveRatioBand.toString(),
                        proof.publicInputs.proofTimestamp.toString(),
                        proof.proofCommitment,
                    ],
                },
            ];
            const res = await sendTransaction(calls);
            setTxHash((res as any).transaction_hash || "submitted");
        } catch (e: any) {
            setError(e.message || "Transaction failed");
        } finally {
            setLoading(false);
        }
    }

    const totalBTC = balances.reduce((s, b) => s + (b.balance ?? b.satoshi ?? 0), 0);

    return (
        <div className="page">
            <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 64 }}>
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Renew Proof</h1>
                    <p className="text-muted mt-1">Generate and submit a fresh solvency proof for your registered entity.</p>
                </div>

                {!isConnected ? (
                    <div className="card card-lg" style={{ textAlign: "center", padding: "48px 32px" }}>
                        <WalletIcon style={{ width: 40, height: 40, color: "var(--text-dim)", margin: "0 auto 16px" }} />
                        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Connect Wallet to Renew</h2>
                        <p className="text-muted mb-6" style={{ maxWidth: 320, margin: "0 auto 24px" }}>
                            Your wallet identifies your registered entity.
                        </p>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                            {uniqueConnectors.map((c) => (
                                <button key={c.id} className="btn btn-primary" onClick={() => connect({ connector: c })} disabled={isConnecting}>
                                    <WalletIcon style={{ width: 16, height: 16 }} />
                                    {isConnecting ? "Connecting..." : `Connect with ${c.name}`}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : loadingEntity ? (
                    <div className="card card-lg flex justify-center items-center gap-2 text-muted">
                        <span className="spinner" /> Looking up your entity...
                    </div>
                ) : !entityInfo ? (
                    <div className="card card-lg" style={{ textAlign: "center", padding: "48px 32px" }}>
                        <ExclamationTriangleIcon style={{ width: 40, height: 40, color: "var(--text-dim)", margin: "0 auto 16px" }} />
                        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Entity Not Found</h2>
                        <p className="text-muted" style={{ marginBottom: 28, maxWidth: 360, margin: "0 auto 28px" }}>
                            You can prove reserves for an entity if you are its authorized registrant.
                        </p>
                        <div className="field mb-4" style={{ textAlign: "left" }}>
                            <label className="label">Target Authorized Wallet Address (Defaults to Connected)</label>
                            <input
                                type="text"
                                className="input input-mono w-full mb-2"
                                placeholder={`e.g. ${walletAddress}`}
                                value={targetWallet}
                                onChange={(e) => setTargetWallet(e.target.value)}
                            />
                        </div>
                        <p className="text-muted" style={{ marginBottom: 28, maxWidth: 360, margin: "0 auto 28px" }}>
                            A target authorized wallet address is required to find your entity registration.
                            The transaction will still be submitted via your connected wallet.
                        </p>
                        <Link href="/onboard" className="btn btn-primary">Go to Registration Wizard</Link>
                    </div>
                ) : (
                    <>
                        {/* ── Step indicator ───────────────────────────────────────── */}
                        <div className="wizard-steps" style={{ marginBottom: 36 }}>
                            {STEP_META.map((s, idx) => {
                                const done = step > s.num;
                                const active = step === s.num;
                                const Icon = s.icon;
                                return (
                                    <div key={s.num} className="wizard-step" style={{ alignItems: "center" }}>
                                        <div className={`wizard-step-num ${active ? "active" : done ? "done" : ""}`} title={s.label}>
                                            {done ? <CheckCircleIcon style={{ width: 14, height: 14 }} /> : <Icon style={{ width: 14, height: 14 }} />}
                                        </div>
                                        <div className={`wizard-step-label ${active ? "active" : ""}`}>{s.label}</div>
                                        {idx < STEP_META.length - 1 && <div className="wizard-connector" />}
                                    </div>
                                );
                            })}
                        </div>

                        {error && (
                            <div className="alert alert-error mb-4">
                                <InformationCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                                {error}
                            </div>
                        )}

                        {/* ───────────────────── STEP 1: BTC Reserves ─────────────── */}
                        {step === 1 && (
                            <div className="card card-lg">
                                <div className="flex items-center gap-3 mb-4">
                                    {getTokenIcon(assetType)}
                                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>Verify wallet addresses</h2>
                                </div>
                                <p className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.7 }}>
                                    Your previously used cold wallet addresses are pre-filled. Update them if needed.
                                </p>
                                <div className="field mb-4">
                                    <label className="label">Select Digital Asset</label>
                                    <div className="flex items-center gap-3">
                                        <div style={{ minWidth: "22px" }}>{getTokenIcon(assetType)}</div>
                                        <select className="input input-mono w-full mb-2" value={assetType} onChange={e => setAssetType(e.target.value)} style={{ appearance: "auto", paddingRight: 32 }}>
                                            <option value="BTC">Bitcoin (BTC) - via Xverse API</option>
                                            <option value="ETH">Ethereum (ETH) - via Public RPC</option>
                                            <option value="USDC">USD Coin (USDC) - via Smart Contract</option>
                                            <option value="SOL">Solana (SOL) - Mocked for Demo</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="field mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="label" style={{ marginBottom: 0 }}>Wallet Addresses ({assetType})</label>
                                        <div>
                                            <input
                                                type="file"
                                                accept=".csv,.txt"
                                                style={{ display: "none" }}
                                                id="walletCsvUpload"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        const text = ev.target?.result as string;
                                                        if (!text) return;
                                                        const lines = text.split("\n").filter(l => l.trim() && !l.toLowerCase().startsWith("address"));
                                                        const parsed = lines.map(l => {
                                                            const parts = l.split(",");
                                                            const address = parts[0]?.trim() || "";
                                                            const network = parts[1]?.trim() || (assetType === "BTC" ? "bitcoin" : "ethereum_sepolia");
                                                            return { address, network };
                                                        }).filter(entry => entry.address);
                                                        if (parsed.length > 0) setAddressEntries(parsed);
                                                        e.target.value = ""; // Reset
                                                    };
                                                    reader.readAsText(file);
                                                }}
                                            />
                                            <label htmlFor="walletCsvUpload" className="btn btn-secondary btn-sm" style={{ cursor: "pointer", fontSize: 11, padding: "4px 8px" }}>
                                                <ArrowUpTrayIcon style={{ width: 12, height: 12 }} /> Upload CSV
                                            </label>
                                        </div>
                                    </div>

                                    {addressEntries.map((entry, idx) => (
                                        <div key={idx} className="flex gap-2 mb-2">
                                            <input
                                                className="input input-mono w-full"
                                                placeholder={(assetType === "ETH" || assetType === "USDC") ? "0x123..." : "bc1qxxx..."}
                                                value={entry.address}
                                                onChange={(e) => {
                                                    const newEntries = [...addressEntries];
                                                    newEntries[idx].address = e.target.value;
                                                    setAddressEntries(newEntries);
                                                }}
                                            />
                                            {assetType !== "SOL" && (
                                                <select
                                                    className="input input-mono"
                                                    value={entry.network}
                                                    onChange={(e) => {
                                                        const newEntries = [...addressEntries];
                                                        newEntries[idx].network = e.target.value;
                                                        setAddressEntries(newEntries);
                                                    }}
                                                    style={{ appearance: "auto", minWidth: 160 }}
                                                >
                                                    {(assetType === "ETH" || assetType === "USDC") ? (
                                                        <>
                                                            <option value="ethereum_sepolia">Eth Sepolia</option>
                                                            <option value="base_sepolia">Base Sepolia</option>
                                                            <option value="arbitrum_sepolia">Arb Sepolia</option>
                                                        </>
                                                    ) : assetType === "BTC" ? (
                                                        <>
                                                            <option value="bitcoin">Bitcoin</option>
                                                            <option value="signet">Signet</option>
                                                            <option value="testnet">Testnet</option>
                                                            <option value="testnet4">Testnet4</option>
                                                        </>
                                                    ) : null}
                                                </select>
                                            )}
                                            <button
                                                className="btn btn-ghost"
                                                style={{ padding: "0 12px" }}
                                                onClick={() => {
                                                    if (addressEntries.length === 1) {
                                                        setAddressEntries([{ address: "", network: "ethereum_sepolia" }]);
                                                    } else {
                                                        setAddressEntries(addressEntries.filter((_, i) => i !== idx));
                                                    }
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        className="btn btn-secondary btn-sm mt-2"
                                        onClick={() => setAddressEntries([...addressEntries, { address: "", network: "ethereum_sepolia" }])}
                                    >
                                        + Add another address
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-primary" onClick={handleFetchBalances} disabled={loading}>
                                        {loading ? <><span className="spinner" /> Fetching...</> : <>Next: Liabilities <ChevronRightIcon style={{ width: 14, height: 14 }} /></>}
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setAddressEntries(DEMO_SCENARIO.addressEntries)}>
                                        Use demo address
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ───────────────────── STEP 2: Liabilities ──────────────── */}
                        {step === 2 && (
                            <div className="card card-lg">
                                <div className="flex items-center gap-3 mb-4">
                                    <TableCellsIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />
                                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>Upload fresh liability CSV</h2>
                                </div>

                                <div className="card card-tight mb-4" style={{ background: "var(--surface-2)" }}>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Total reserves fetched</div>
                                    <div style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 700, color: "var(--green)" }}>
                                        {satoshiToBTC(totalBTC)} {assetType}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{assetType} network block height #{blockHeight.toLocaleString()}</div>
                                </div>

                                <div className="field mb-3">
                                    <label className="label">Upload CSV file</label>
                                    <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                                        <ArrowUpTrayIcon style={{ width: 16, height: 16 }} /> Choose File
                                    </button>
                                    <input type="file" ref={fileRef} accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
                                </div>
                                <div className="field mb-4">
                                    <label className="label">Or paste CSV content</label>
                                    <textarea
                                        className="input input-mono"
                                        rows={6}
                                        placeholder={"account_id,liability\n0x05d985a6eabf7b1df25e01bcdfbaedce38b4d8349141be36d2460668b577a493,20000\n0x018b32087508cf31c463b28ee55ac7bbaec7fd3bc65c92c97f48ff3cbec8a1ce,30000"}
                                        value={csvContent}
                                        onChange={(e) => setCsvContent(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>Back</button>
                                    <button className="btn btn-primary" onClick={() => { if (csvContent.trim()) setStep(3); else setError("Upload or paste a CSV first"); }}>
                                        Next: Prove <ChevronRightIcon style={{ width: 14, height: 14 }} />
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setCsvContent(DEMO_SCENARIO.liabilityCsv)}>
                                        Use demo CSV
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ───────────────────── STEP 3: Prove ────────────────────── */}
                        {step === 3 && (
                            <div className="card card-lg">
                                <div className="flex items-center gap-3 mb-4">
                                    <CpuChipIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />
                                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>Run the ZK circuit</h2>
                                </div>

                                {progressSteps.length > 0 && (
                                    <div style={{ marginBottom: 20 }}>
                                        {progressSteps.map((s, idx) => (
                                            <div key={idx} className="progress-step">
                                                <div className={`step-icon step-icon-${s.status}`}>
                                                    {s.status === "done" && <CheckCircleIcon style={{ width: 16, height: 16 }} />}
                                                    {s.status === "running" && <span className="spinner" style={{ width: 14, height: 14 }} />}
                                                    {s.status === "pending" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-dim)" }} />}
                                                </div>
                                                <span className={`step-text ${s.status === "done" ? "done" : ""}`}>{s.step}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button className="btn btn-secondary btn-sm" onClick={() => setStep(2)}>Back</button>
                                    <button className="btn btn-primary" onClick={handleRunCircuit} disabled={loading}>
                                        {loading ? <><span className="spinner" /> Running circuit...</> : <><CpuChipIcon style={{ width: 15, height: 15 }} /> Run Circuit</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ───────────────────── STEP 4: Submit ───────────────────── */}
                        {step === 4 && (
                            <div className="card card-lg">
                                <div className="flex items-center gap-3 mb-4">
                                    <CheckCircleIcon style={{ width: 22, height: 22, color: txHash ? "var(--green)" : "var(--accent)" }} />
                                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>{txHash ? "Proof renewed" : "Sign and submit"}</h2>
                                </div>

                                {txHash ? (
                                    <div>
                                        <div className="alert alert-success mb-4">
                                            <CheckCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                                            Renewal submitted successfully.
                                        </div>
                                        <div className="field mb-4">
                                            <label className="label">Transaction Hash</label>
                                            <div className="code-block" style={{ wordBreak: "break-all" }}>{txHash}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Link href="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
                                            <a href={`https://sepolia.voyager.online/tx/${txHash}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">View on Voyager</a>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.7 }}>
                                            Signing a <code>submit_proof</code> transaction to update your on-chain record for another 28 days.
                                        </p>

                                        {proof && (
                                            <div className="card card-tight mb-4" style={{ background: "var(--surface-2)" }}>
                                                {[
                                                    { k: "Entity ID", v: entityInfo.id.slice(0, 24) + "..." },
                                                    { k: "Block Height", v: `#${proof.publicInputs?.blockHeight}` },
                                                    { k: "Reserve Band", v: `Band ${proof.publicInputs?.reserveRatioBand}` },
                                                ].map(({ k, v }) => (
                                                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{k}</span>
                                                        <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <button className="btn btn-secondary btn-sm" onClick={() => setStep(3)}>Back</button>
                                            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                                                {loading ? <><span className="spinner" /> Submitting...</> : "Sign and Submit"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
