import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Web3Provider } from "./providers";

export const metadata: Metadata = {
	title: "Live Art - Crypto Art Auction",
	description: "Live crypto art auction platform",
	icons: {
		icon: [
			{
				url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎨</text></svg>",
			},
		],
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="min-h-screen antialiased" suppressHydrationWarning>
				<Web3Provider>{children}</Web3Provider>
			</body>
		</html>
	);
}
