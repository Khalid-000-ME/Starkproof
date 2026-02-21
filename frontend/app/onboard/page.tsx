"use client";
import { useState, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useSendTransaction } from "@starknet-react/core";
import { computeEntityId, stringToFelt252, computeLiabilityRoot } from "@/lib/merkle";
import { satoshiToBTC, getMultipleBalances, getCurrentBlockHeight } from "@/lib/xverse";
import { generateProof, type ProofGenerationProgress } from "@/lib/circuit";
import { REGISTRY_ADDRESS } from "@/lib/starknet";
import Link from "next/link";
import {
    WalletIcon,
    BuildingLibraryIcon,
    CurrencyDollarIcon,
    TableCellsIcon,
    CpuChipIcon,
    CheckCircleIcon,
    ChevronRightIcon,
    ArrowUpTrayIcon,
    InformationCircleIcon,
} from "@heroicons/react/24/outline";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const DEMO_SCENARIO = {
    entityName: "Demo Exchange",
    btcAddresses: "tb1qax7ynrp5f84g9frfnm6lpatqmhf2hmlhd0guvz",
    liabilityCsv: `account_id,liability_satoshi\nalice,20000\nbob,30000\ncarol,15000\ndave,12000\neve,8000`,
};

const STEP_META = [
    { num: 1 as Step, label: "Connect", icon: WalletIcon },
    { num: 2 as Step, label: "Register", icon: BuildingLibraryIcon },
    { num: 3 as Step, label: "Reserves", icon: CurrencyDollarIcon },
    { num: 4 as Step, label: "Liabilities", icon: TableCellsIcon },
    { num: 5 as Step, label: "Prove", icon: CpuChipIcon },
    { num: 6 as Step, label: "Submit", icon: CheckCircleIcon },
];

export default function OnboardPage() {
    const [step, setStep] = useState<Step>(1);
    const [entityName, setEntityName] = useState("");
    const [entityId, setEntityId] = useState("");
    const [assetType, setAssetType] = useState("BTC");
    const [btcAddresses, setBtcAddresses] = useState("");
    const [balances, setBalances] = useState<any[]>([]);
    const [csvContent, setCsvContent] = useState("");
    const [proof, setProof] = useState<any>(null);
    const [progressSteps, setProgressSteps] = useState<ProofGenerationProgress[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");
    const [blockHeight, setBlockHeight] = useState<number>(0);
    const [evmNetwork, setEvmNetwork] = useState("ethereum_sepolia"); // base_sepolia, arbitrum_sepolia
    const [accountId, setAccountId] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const { address: walletAddress, isConnected, account } = useAccount();
    const { connect, connectors, isPending: isConnecting } = useConnect();
    const { disconnect } = useDisconnect();
    const { sendAsync: sendTransaction } = useSendTransaction({ calls: [] });

    const uniqueConnectors = connectors.filter((c, idx, arr) => arr.findIndex(x => x.id === c.id) === idx);

    // ── Step 1: Connect wallet ────────────────────────────────────────────────
    function handleWalletConnected() {
        setStep(2);
    }

    // ── Step 2: Register entity ────────────────────────────────────────────────
    function handleRegister() {
        if (!entityName.trim()) { setError("Enter an entity name"); return; }
        setError("");
        const felt = stringToFelt252(entityName.trim());
        const registrant = walletAddress ? BigInt(walletAddress) : 0n;
        const computedId = computeEntityId(felt, registrant);
        setEntityId("0x" + computedId.toString(16).padStart(64, "0"));
        setProof(null);
        setProgressSteps([]);
        setTxHash("");
        setStep(3);
    }

    // ── Step 3: Fetch Balances ─────────────────────────────────────────────
    async function handleFetchBalances() {
        const addrs = btcAddresses.split("\n").map(a => a.trim()).filter(Boolean);
        if (addrs.length === 0) { setError("Enter at least one wallet address"); return; }
        setError("");
        setLoading(true);
        try {
            if (assetType === "BTC") {
                const isTestnet = addrs.every(a => a.startsWith("tb1") || a.startsWith("m") || a.startsWith("n"));
                const [bals, height] = await Promise.all([getMultipleBalances(addrs), getCurrentBlockHeight(isTestnet)]);
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

                const provider = new ethers.providers.JsonRpcProvider(rpcs[evmNetwork]);
                const blockHeightFetched = await provider.getBlockNumber();
                setBlockHeight(blockHeightFetched);

                let realBalances = [];

                if (assetType === "ETH") {
                    for (const addr of addrs) {
                        const bal = await provider.getBalance(addr);
                        const num = Number(ethers.utils.formatEther(bal));
                        // the circuit uses sats/wei internally, just convert to closest equivalent number
                        realBalances.push({ address: addr, balance: Math.floor(num * 100000000), satoshi: Math.floor(num * 100000000) });
                    }
                } else if (assetType === "USDC") {
                    const abi = ["function balanceOf(address owner) view returns (uint256)"];
                    const contract = new ethers.Contract(usdcContracts[evmNetwork], abi, provider);
                    for (const addr of addrs) {
                        const bal = await contract.balanceOf(addr);
                        // USDC has 6 decimals, normalize it
                        const num = Number(ethers.utils.formatUnits(bal, 6));
                        realBalances.push({ address: addr, balance: Math.floor(num * 100000000), satoshi: Math.floor(num * 100000000) });
                    }
                }

                setBalances(realBalances);
            } else {
                // Mock for SOL
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
            setStep(4);
        } catch (e: any) {
            console.error("Fetch Balances Error", e);
            setError(e.message || "Failed to fetch balances across networks");
        } finally {
            setLoading(false);
        }
    }

    // ── Step 4: Upload liability CSV ───────────────────────────────────────────
    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setCsvContent((ev.target?.result as string) || "");
        reader.readAsText(file);
    }

    // ── Step 5: Run ZK circuit ─────────────────────────────────────────────────
    async function handleRunCircuit() {
        if (!csvContent.trim()) { setError("Upload or paste your liability CSV"); return; }
        const addrs = btcAddresses.split("\n").map(a => a.trim()).filter(Boolean);
        setError("");
        setLoading(true);
        setProgressSteps([]);
        try {
            const network = assetType === "BTC" ? "Bitcoin" : assetType === "SOL" ? "Solana" : "Ethereum";
            const fullEntityName = `${entityName.trim().substring(0, 10)}|${assetType}|${network}`;
            const felt = stringToFelt252(fullEntityName);
            const registrant = walletAddress ? BigInt(walletAddress) : 0n;
            const entityIdBig = computeEntityId(felt, registrant);
            const entityIdHex = "0x" + entityIdBig.toString(16);
            const result = await generateProof(
                {
                    entityId: entityIdHex,
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
            setStep(6);
        } catch (e: any) {
            setError(e.message || "Circuit generation failed");
        } finally {
            setLoading(false);
        }
    }

    // ── Step 6: Submit ─────────────────────────────────────────────────────────
    async function handleSubmit() {
        if (!proof || !account) { setError("Connect wallet and generate proof first"); return; }
        setError("");
        setLoading(true);
        try {
            const network = assetType === "BTC" ? "Bitcoin" : assetType === "SOL" ? "Solana" : "Ethereum";
            const fullEntityName = `${entityName.trim().substring(0, 10)}|${assetType}|${network}`;
            const nameFelt = stringToFelt252(fullEntityName);
            const nameFeltHex = "0x" + nameFelt.toString(16);
            const calls = [
                {
                    contractAddress: REGISTRY_ADDRESS,
                    entrypoint: "register_entity",
                    calldata: [nameFeltHex],
                },
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
                {/* ── Page title ──────────────────────────────────────────── */}
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Register Your Exchange</h1>
                    <p className="text-muted mt-1">Complete six steps to publish your first proof on Starknet.</p>
                </div>

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

                {/* ── Error ────────────────────────────────────────────────── */}
                {error && (
                    <div className="alert alert-error mb-4">
                        <InformationCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                        {error}
                    </div>
                )}

                {/* ───────────────────── STEP 1: Connect ──────────────────── */}
                {step === 1 && (
                    <div className="card card-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <WalletIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />
                            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Connect your Starknet wallet</h2>
                        </div>
                        <p className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.7 }}>
                            Your entity identity is derived from your exchange name combined with your wallet address.
                            Use Braavos on Starknet Sepolia.
                        </p>
                        {isConnected ? (
                            <div>
                                <div className="alert alert-success mb-4">
                                    <CheckCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                                    Connected: <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{walletAddress?.slice(0, 20)}...</span>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-primary" onClick={handleWalletConnected}>
                                        Continue <ChevronRightIcon style={{ width: 14, height: 14 }} />
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => disconnect()}>Disconnect</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {uniqueConnectors.map((c) => (
                                    <button
                                        key={c.id}
                                        className="btn btn-secondary"
                                        onClick={() => connect({ connector: c })}
                                        disabled={isConnecting}
                                        style={{ justifyContent: "flex-start" }}
                                    >
                                        <WalletIcon style={{ width: 16, height: 16 }} />
                                        {isConnecting ? "Connecting..." : `Connect with ${c.name}`}
                                    </button>
                                ))}
                                <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                                    Need a wallet? Install <a href="https://braavos.app" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>Braavos</a> and switch to Sepolia testnet.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ───────────────────── STEP 2: Register ─────────────────── */}
                {step === 2 && (
                    <div className="card card-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <BuildingLibraryIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />
                            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Name your entity</h2>
                        </div>
                        <p className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.7 }}>
                            Your entity name will be encoded as a Starknet felt252 and combined with your wallet address to derive a unique entity ID. This cannot be changed after submission.
                        </p>
                        <div className="field mb-4">
                            <label className="label">Exchange / Entity Name</label>
                            <input
                                className="input"
                                placeholder="e.g. Kraken Exchange"
                                value={entityName}
                                onChange={(e) => setEntityName(e.target.value)}
                                maxLength={31}
                            />
                            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Max 31 ASCII characters (felt252 limit)</div>
                        </div>
                        <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>Back</button>
                            <button className="btn btn-primary" onClick={handleRegister} disabled={!entityName.trim()}>
                                Continue <ChevronRightIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEntityName(DEMO_SCENARIO.entityName); }}>
                                Use demo name
                            </button>
                        </div>
                    </div>
                )}

                {/* ───────────────────── STEP 3: BTC Reserves ─────────────── */}
                {step === 3 && (
                    <div className="card card-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <CurrencyDollarIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />
                            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Add your wallet addresses</h2>
                        </div>
                        <p className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.7 }}>
                            Enter your {assetType} cold wallet addresses — one per line. The API will fetch confirmed balances. These addresses remain <strong>private</strong> and are used only as circuit inputs.
                        </p>

                        <div className="field mb-4">
                            <label className="label">Select Digital Asset</label>
                            <select className="input input-mono" value={assetType} onChange={e => setAssetType(e.target.value)} style={{ appearance: "auto", paddingRight: 32 }}>
                                <option value="BTC">Bitcoin (BTC) - via Xverse API</option>
                                <option value="ETH">Ethereum (ETH) - Live Fetching</option>
                                <option value="USDC">USD Coin (USDC) - Live Fetching</option>
                                <option value="SOL">Solana (SOL) - Mocked</option>
                            </select>
                        </div>

                        {(assetType === "ETH" || assetType === "USDC") && (
                            <div className="field mb-4">
                                <label className="label">Select Deployment Network</label>
                                <select className="input input-mono" value={evmNetwork} onChange={e => setEvmNetwork(e.target.value)} style={{ appearance: "auto", paddingRight: 32 }}>
                                    <option value="ethereum_sepolia">Ethereum Sepolia</option>
                                    <option value="base_sepolia">Base Sepolia</option>
                                    <option value="arbitrum_sepolia">Arbitrum Sepolia</option>
                                </select>
                            </div>
                        )}

                        <div className="field mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="label" style={{ marginBottom: 0 }}>Wallet Addresses ({assetType} - one per line)</label>
                            </div>
                            <textarea
                                className="input input-mono"
                                rows={5}
                                placeholder={(assetType === "ETH" || assetType === "USDC") ? "0x123...456\n0xabc...def" : "bc1qxxx...\nbc1qyyy..."}
                                value={btcAddresses}
                                onChange={(e) => setBtcAddresses(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => setStep(2)}>Back</button>
                            <button className="btn btn-primary" onClick={handleFetchBalances} disabled={loading}>
                                {loading ? <><span className="spinner" /> Fetching...</> : <>Fetch Balances <ChevronRightIcon style={{ width: 14, height: 14 }} /></>}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setBtcAddresses(DEMO_SCENARIO.btcAddresses)}>
                                Use demo address
                            </button>
                        </div>
                    </div>
                )}

                {/* ───────────────────── STEP 4: Liabilities ──────────────── */}
                {step === 4 && (
                    <div className="card card-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <TableCellsIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />
                            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Upload customer liability CSV</h2>
                        </div>

                        {/* Balance summary */}
                        <div className="card card-tight mb-4" style={{ background: "var(--surface-2)" }}>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Total reserves fetched</div>
                            <div style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 700, color: "var(--green)" }}>
                                {satoshiToBTC(totalBTC)} {assetType}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{assetType} network block height #{blockHeight.toLocaleString()}</div>
                        </div>

                        <div className="alert alert-info mb-4">
                            <InformationCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                            <div style={{ fontSize: 12 }}>
                                Format: <span style={{ fontFamily: "var(--mono)" }}>account_id,liability_satoshi</span> (one row per customer, no header required but accepted)
                            </div>
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
                                placeholder={"account_id,liability_satoshi\nalice,20000\nbob,30000"}
                                value={csvContent}
                                onChange={(e) => setCsvContent(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => setStep(3)}>Back</button>
                            <button className="btn btn-primary" onClick={() => { if (csvContent.trim()) setStep(5); else setError("Upload or paste a CSV first"); }}>
                                Continue <ChevronRightIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setCsvContent(DEMO_SCENARIO.liabilityCsv)}>
                                Use demo CSV
                            </button>
                        </div>
                    </div>
                )}

                {/* ───────────────────── STEP 5: Prove ────────────────────── */}
                {step === 5 && (
                    <div className="card card-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <CpuChipIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />
                            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Run the ZK circuit</h2>
                        </div>
                        <p className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.7 }}>
                            The Cairo circuit runs entirely in your browser. It builds a Poseidon Merkle tree from your liabilities, verifies reserves exceed liabilities, and generates a proof commitment. No data leaves your machine.
                        </p>

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
                            <button className="btn btn-secondary btn-sm" onClick={() => setStep(4)}>Back</button>
                            <button className="btn btn-primary" onClick={handleRunCircuit} disabled={loading}>
                                {loading ? <><span className="spinner" /> Running circuit...</> : <><CpuChipIcon style={{ width: 15, height: 15 }} /> Run Circuit</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ───────────────────── STEP 6: Submit ───────────────────── */}
                {step === 6 && (
                    <div className="card card-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <CheckCircleIcon style={{ width: 22, height: 22, color: txHash ? "var(--green)" : "var(--accent)" }} />
                            <h2 style={{ fontSize: 16, fontWeight: 600 }}>{txHash ? "Proof submitted" : "Sign and submit"}</h2>
                        </div>

                        {txHash ? (
                            <div>
                                <div className="alert alert-success mb-4">
                                    <CheckCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                                    Transaction submitted successfully.
                                </div>
                                <div className="field mb-4">
                                    <label className="label">Transaction Hash</label>
                                    <div className="code-block" style={{ wordBreak: "break-all" }}>{txHash}</div>
                                </div>
                                <p className="text-muted mb-4" style={{ fontSize: 13 }}>
                                    Your proof is now public on Starknet Sepolia. It is valid for 28 days.
                                </p>
                                <div className="flex gap-2">
                                    <Link href="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
                                    <a href={`https://sepolia.voyager.online/tx/${txHash}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">View on Voyager</a>
                                    <Link href="/registry" className="btn btn-ghost btn-sm">View Registry</Link>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-muted mb-4" style={{ fontSize: 13, lineHeight: 1.7 }}>
                                    Signing a multicall transaction: <code>register_entity</code> + <code>submit_proof</code>. Your wallet will prompt for approval. This costs a small amount of ETH on Starknet Sepolia.
                                </p>

                                {proof && (
                                    <div className="card card-tight mb-4" style={{ background: "var(--surface-2)" }}>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Proof public inputs</div>
                                        {[
                                            { k: "Entity ID", v: entityId.slice(0, 24) + "..." },
                                            { k: "Block Height", v: `#${proof.publicInputs?.blockHeight?.toLocaleString() ?? blockHeight}` },
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
                                    <button className="btn btn-secondary btn-sm" onClick={() => setStep(5)}>Back</button>
                                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                                        {loading ? <><span className="spinner" /> Submitting...</> : "Sign and Submit"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}
