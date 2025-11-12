/**
 * Clipboard utilities for copying text to clipboard
 */

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		} else {
			// Fallback for older browsers
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			
			try {
				document.execCommand('copy');
				document.body.removeChild(textArea);
				return true;
			} catch (err) {
				document.body.removeChild(textArea);
				return false;
			}
		}
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
		return false;
	}
}

