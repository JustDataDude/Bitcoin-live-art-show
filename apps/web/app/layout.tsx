import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { SuppressExtensionErrors } from "./components/SuppressExtensionErrors";

// Lazy load Web3Provider - only loads when wallet components are used
const Web3Provider = dynamic(() => import("./providers").then(mod => ({ default: mod.Web3Provider })), {
	ssr: false,
	loading: () => null, // No loading indicator needed
});

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
				<SuppressExtensionErrors />
				<Suspense fallback={null}>
					<Web3Provider>
						{children}
						<Suspense fallback={null}>
							<ToastContainer />
						</Suspense>
					</Web3Provider>
				</Suspense>
			</body>
		</html>
	);
}
