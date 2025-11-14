"use client";

import { useEffect } from "react";

/**
 * Suppresses harmless browser extension errors in the console.
 * These errors come from wallet extensions (like Xverse) trying to inject
 * themselves into the page and are not actual application errors.
 */
export function SuppressExtensionErrors() {
	useEffect(() => {
		// Suppress known browser extension errors
		const originalError = console.error;
		const originalWarn = console.warn;

		// List of error patterns to suppress
		const suppressedPatterns = [
			/Error sending to background hostname check/,
			/Could not establish connection\. Receiving end does not exist/,
			/Failed setting Xverse Stacks default provider/,
			/Cannot redefine property: StacksProvider/,
			/hostname_check.*error/,
			/runtime\.lastError/,
		];

		console.error = (...args: any[]) => {
			const message = args.join(" ");
			const shouldSuppress = suppressedPatterns.some(pattern => pattern.test(message));
			
			if (!shouldSuppress) {
				originalError.apply(console, args);
			}
		};

		console.warn = (...args: any[]) => {
			const message = args.join(" ");
			const shouldSuppress = suppressedPatterns.some(pattern => pattern.test(message));
			
			if (!shouldSuppress) {
				originalWarn.apply(console, args);
			}
		};

		// Suppress unhandled promise rejections from extensions
		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			const reason = event.reason?.toString() || "";
			const shouldSuppress = suppressedPatterns.some(pattern => pattern.test(reason));
			
			if (shouldSuppress) {
				event.preventDefault();
			}
		};

		window.addEventListener("unhandledrejection", handleUnhandledRejection);

		// Cleanup
		return () => {
			console.error = originalError;
			console.warn = originalWarn;
			window.removeEventListener("unhandledrejection", handleUnhandledRejection);
		};
	}, []);

	return null;
}

