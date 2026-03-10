"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect, useConnect } from "@starknet-react/core";
import { useStarknetkitConnectModal } from "starknetkit";
import {
    ChartBarIcon,
    ShieldCheckIcon,
    Squares2X2Icon,
    ArrowRightOnRectangleIcon,
    WalletIcon,
} from "@heroicons/react/24/outline";

const PUBLIC_LINKS = [
    { href: "/registry", label: "Registry", icon: ChartBarIcon },
    { href: "/verify", label: "Verify", icon: ShieldCheckIcon },
];

export default function Navbar() {
    const pathname = usePathname();
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { connect, connectors } = useConnect();
    const uniqueConnectors = connectors.filter((c, idx, arr) => arr.findIndex(x => x.id === c.id) === idx);
    const { starknetkitConnectModal } = useStarknetkitConnectModal({
        connectors: uniqueConnectors as any[],
        modalTheme: "dark",
        modalMode: "alwaysAsk"
    });

    const isLanding = pathname === "/";

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                {/* Logo */}
                <Link href="/" className="navbar-logo" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0px" }}>
                    <img src="/logo.png" alt="Starkproof Logo" style={{ width: 20, height: 20, borderRadius: 4 }} />
                    Starkproof
                </Link>

                {/* Center links */}
                <div className="navbar-links">
                    {PUBLIC_LINKS.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`nav-link${pathname.startsWith(href) ? " active" : ""}`}
                        >
                            {label}
                        </Link>
                    ))}
                    {isConnected && (
                        <Link
                            href="/dashboard"
                            className={`nav-link${pathname === "/dashboard" ? " active" : ""}`}
                        >
                            Dashboard
                        </Link>
                    )}
                    <Link href="/docs" className={`nav-link${pathname === "/docs" ? " active" : ""}`}
                        style={{ display: "none" }}>
                        Docs
                    </Link>
                </div>

                {/* Right actions */}
                <div className="navbar-actions">

                    {isConnected ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Link href="/dashboard" className="btn btn-secondary btn-sm" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                                <WalletIcon style={{ width: 13, height: 13 }} />
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                            </Link>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => disconnect()}
                                title="Disconnect wallet"
                            >
                                <ArrowRightOnRectangleIcon style={{ width: 14, height: 14 }} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={async () => {
                                disconnect();
                                try {
                                    localStorage.removeItem("starknetkit-last-wallet-id");
                                    localStorage.removeItem("starknetLastConnectedWallet");
                                    localStorage.removeItem("walletconnect");
                                } catch (e) { }

                                const { connector } = await starknetkitConnectModal();
                                if (connector) {
                                    connect({ connector });
                                }
                            }}
                            className="btn btn-primary btn-sm"
                        >
                            <WalletIcon style={{ width: 14, height: 14 }} />
                            Connect Wallet
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}
