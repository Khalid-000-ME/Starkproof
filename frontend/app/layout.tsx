import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { StarknetProvider } from "@/components/StarknetProvider";

export const metadata: Metadata = {
    title: "Starkproof — Private Proof of Solvency on Starknet",
    description:
        "Trustless, privacy-preserving Proof of Reserves for Bitcoin custodians. Prove solvency without revealing wallet addresses or balances.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <StarknetProvider>
                    <Navbar />
                    {children}
                </StarknetProvider>
            </body>
        </html>
    );
}
