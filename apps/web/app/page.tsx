"use client";

import Link from "next/link";
import { Button } from "@live-art/ui";
import { Logo } from "../components/Logo";
import { UserLogin } from "../components/UserLogin";

export default function HomePage() {
	return (
		<main className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-purple-900 to-slate-900 text-white">
			{/* Animated background accents */}
			<div className="pointer-events-none absolute inset-0">
				<div className="absolute -top-32 -left-20 w-72 h-72 bg-purple-500/40 rounded-full blur-3xl animate-pulse"></div>
				<div className="absolute -bottom-32 -right-24 w-80 h-80 bg-pink-500/40 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]"></div>
				<div className="absolute top-1/2 left-1/2 w-64 h-64 -translate-x-1/2 -translate-y-1/2 bg-blue-500/20 rounded-full blur-3xl animate-[spin_18s_linear_infinite]"></div>
			</div>

			<section className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-16 flex flex-col lg:flex-row items-center gap-16">
				<div className="flex-1 space-y-6">
					{/* Logo */}
					<div className="flex justify-center lg:justify-start pb-2">
						<Logo size="lg" />
					</div>
					
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur">
						<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
						<span className="text-xs tracking-[0.35em] uppercase text-emerald-200">Live right now</span>
					</div>
					<h1 className="text-5xl lg:text-6xl font-black leading-tight">
						<span className="bg-gradient-to-r from-emerald-300 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
							Step into the 1 of 1&apos;s Game Show
						</span>
					</h1>
					<p className="text-lg text-slate-200 max-w-xl">
						An electrifying fusion of crypto, art, and live entertainment. Vote for your favorite artists,
						bid on one-of-a-kind pieces, tip performers in real time, and feel the rush of a global audience
						cheering with you.
					</p>
					<div className="flex items-center gap-4 pt-2">
						<UserLogin />
						<Link href="/show/seed-show-1">
							<Button
								size="lg"
								className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500 text-slate-900 font-bold shadow-[0_20px_45px_-15px_rgba(16,185,129,0.6)] border border-emerald-300/60 transition-transform hover:scale-[1.05] hover:shadow-[0_25px_65px_-18px_rgba(16,185,129,0.7)] whitespace-nowrap"
							>
								Enter Live Show
							</Button>
						</Link>
						<Link href="/marketplace">
							<Button
								size="lg"
								variant="ghost"
								className="bg-white/15 hover:bg-white/25 text-white font-semibold border border-white/40 hover:border-white/60 shadow-[0_20px_45px_-18px_rgba(255,255,255,0.2)] transition-transform hover:-translate-y-1 hover:shadow-[0_25px_65px_-20px_rgba(255,255,255,0.28)] whitespace-nowrap"
							>
								Explore Marketplace
							</Button>
						</Link>
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-slate-300">
						{[
							{
								title: "Live",
								highlight: "text-emerald-300",
								body: "Real-time bidding & tipping",
							},
							{
								title: "4+",
								highlight: "text-cyan-300",
								body: "Artists streaming simultaneously",
							},
							{
								title: "Votes",
								highlight: "text-purple-300",
								body: "Interactive audience showdown",
							},
							{
								title: "Royalties",
								highlight: "text-pink-300",
								body: "Artists earn from every trade",
							},
						].map((card) => (
							<div
								key={card.title}
								className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm text-center flex flex-col items-center justify-center gap-1.5"
							>
								<p className={`text-2xl font-bold ${card.highlight}`}>{card.title}</p>
								<p className="max-w-[12ch] leading-snug">{card.body}</p>
							</div>
						))}
					</div>
				</div>

				<div className="flex-1 w-full">
					<div className="relative aspect-[4/5] rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl overflow-hidden shadow-[0_40px_120px_-40px_rgba(137,103,255,0.5)]">
						<div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_60%)]"></div>
						<div className="absolute inset-6 rounded-2xl border border-white/10 bg-black/60 p-6 flex flex-col justify-between">
							<div className="space-y-4">
								<p className="text-sm tracking-[0.25em] uppercase text-purple-200/80">Tonight&apos;s Lineup</p>
								<ul className="space-y-3 text-base">
									<li className="flex items-center gap-3">
										<span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse"></span>
										<span className="text-lime-200">Artist 1 — Generative Vibes</span>
									</li>
									<li className="flex items-center gap-3">
										<span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
										<span className="text-sky-200">Artist 2 — Neo-Glitch Reality</span>
									</li>
									<li className="flex items-center gap-3">
										<span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
										<span className="text-rose-200">Artist 3 — Chromatic Dreams</span>
									</li>
									<li className="flex items-center gap-3">
										<span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
										<span className="text-amber-200">Artist 4 — Fractal Odyssey</span>
									</li>
								</ul>
							</div>
							<div className="space-y-3">
								<div className="flex items-center justify-between text-sm text-slate-200">
									<span>Highest Bid</span>
									<span className="font-semibold text-emerald-300">$12,500</span>
								</div>
								<div className="flex items-center justify-between text-sm text-slate-200">
									<span>Audience Votes</span>
									<span className="font-semibold text-cyan-300">Live Updating</span>
								</div>
								<div className="flex items-center justify-between text-sm text-slate-200">
									<span>Next Auction</span>
									<span className="font-semibold text-purple-300">Starts in 4m 12s</span>
								</div>
							</div>
						</div>
						<div className="absolute -right-10 bottom-12 w-32 h-32 rounded-full bg-emerald-400/80 blur-3xl animate-[pulse_7s_ease-in-out_infinite]"></div>
					</div>
				</div>
			</section>
		</main>
	);
}
