"use client";

import { useState, useEffect } from "react";
import { Tooltip } from "./Tooltip";

export function KeyboardShortcuts() {
	const [showHelp, setShowHelp] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't trigger when typing in inputs
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			// Press ? to show/hide help
			if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
				e.preventDefault();
				setShowHelp(prev => !prev);
			}

			// Press Escape to close help
			if (e.key === 'Escape' && showHelp) {
				setShowHelp(false);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [showHelp]);

	if (!showHelp) {
		return (
			<Tooltip content="Press ? to view keyboard shortcuts" position="bottom">
				<button
					onClick={() => setShowHelp(true)}
					className="fixed bottom-4 right-4 z-40 w-10 h-10 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors"
					aria-label="Show keyboard shortcuts"
				>
					<span className="text-lg font-bold">?</span>
				</button>
			</Tooltip>
		);
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={() => setShowHelp(false)}
		>
			<div
				className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 p-6 max-w-md w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
					<button
						onClick={() => setShowHelp(false)}
						className="text-slate-400 hover:text-white transition-colors"
						aria-label="Close"
					>
						✕
					</button>
				</div>
				<div className="space-y-3 text-sm">
					<div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
						<span className="text-slate-300">Focus Bid Input</span>
						<kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">Ctrl/Cmd + B</kbd>
					</div>
					<div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
						<span className="text-slate-300">Focus Tip Input</span>
						<kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">Ctrl/Cmd + T</kbd>
					</div>
					<div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
						<span className="text-slate-300">Focus Chat Input</span>
						<kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">Ctrl/Cmd + M</kbd>
					</div>
					<div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
						<span className="text-slate-300">Show/Hide Help</span>
						<kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">?</kbd>
					</div>
					<div className="flex justify-between items-center p-2 bg-slate-800/50 rounded">
						<span className="text-slate-300">Send Message</span>
						<kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">Enter</kbd>
					</div>
				</div>
				<button
					onClick={() => setShowHelp(false)}
					className="mt-6 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
				>
					Got it!
				</button>
			</div>
		</div>
	);
}

