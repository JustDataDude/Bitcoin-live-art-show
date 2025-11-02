import Link from "next/link";
import { Button } from "@live-art/ui";

export default function HomePage() {
	return (
		<main className="max-w-3xl mx-auto p-6 space-y-4">
			<h1 className="text-3xl font-bold">live-art</h1>
			<p className="text-neutral-300">Live crypto art auction demo.</p>
			<Link href="/show/seed-show-1">
				<Button>Enter Demo Show</Button>
			</Link>
		</main>
	);
}
