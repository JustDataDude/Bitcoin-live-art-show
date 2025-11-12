import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Web3Provider } from "./providers";
import dynamic from "next/dynamic";

const ToastContainer = dynamic(() => import("../components/Toast").then(mod => ({ default: mod.ToastContainer })), {
	ssr: false,
});

export const metadata: Metadata = {
	title: "1 of 1's Game Show - Live Art Auction",
	description: "Live crypto art auction platform",
	icons: {
		icon: "/logo.png",
		apple: "/logo.png",
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="min-h-screen antialiased" suppressHydrationWarning>
				<Web3Provider>
					{children}
					<ToastContainer />
				</Web3Provider>
			</body>
		</html>
	);
}
