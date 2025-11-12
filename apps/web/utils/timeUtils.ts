/**
 * Time formatting utilities for user-friendly display
 */

export function formatRelativeTime(timestamp: number | Date): string {
	const now = Date.now();
	const time = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
	const diffMs = now - time;
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSeconds < 10) {
		return "just now";
	} else if (diffSeconds < 60) {
		return `${diffSeconds}s ago`;
	} else if (diffMinutes < 60) {
		return `${diffMinutes}m ago`;
	} else if (diffHours < 24) {
		return `${diffHours}h ago`;
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else {
		// For older dates, show actual date
		const date = new Date(time);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
}

export function formatTime(timestamp: number | Date): string {
	const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
	return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDateTime(timestamp: number | Date): string {
	const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

