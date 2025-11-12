"use client";

interface ConfirmationModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	confirmVariant?: "danger" | "primary";
}

export function ConfirmationModal({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	confirmText = "Confirm",
	cancelText = "Cancel",
	confirmVariant = "primary",
}: ConfirmationModalProps) {
	if (!isOpen) return null;

	const handleConfirm = () => {
		onConfirm();
		onClose();
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<div
				className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 p-6 max-w-md w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 id="modal-title" className="text-2xl font-bold text-white mb-4">
					{title}
				</h2>
				<p className="text-slate-300 mb-6">{message}</p>
				<div className="flex justify-end gap-3">
					<button
						onClick={onClose}
						className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
					>
						{cancelText}
					</button>
					<button
						onClick={handleConfirm}
						className={`px-4 py-2 rounded-lg font-semibold text-white transition-colors ${
							confirmVariant === "danger"
								? "bg-red-600 hover:bg-red-700"
								: "bg-blue-600 hover:bg-blue-700"
						}`}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
}

