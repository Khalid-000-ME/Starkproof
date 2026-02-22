"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "@starknet-react/core";
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

    const isLanding = pathname === "/";

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                {/* Logo */}
                <Link href="/" className="navbar-logo">
                    <img src="/logo.png" alt="zkReserves Logo" style={{ width: 20, height: 20, borderRadius: 4 }} />
                    zk<span>Reserves</span>
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
                    <span className="badge badge-orange" style={{ fontSize: 10 }}>Sepolia</span>

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
                        <Link
                            href={isLanding ? "/onboard" : "/onboard"}
                            className="btn btn-primary btn-sm"
                        >
                            <WalletIcon style={{ width: 14, height: 14 }} />
                            {isLanding ? "Register Exchange" : "Connect"}
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
