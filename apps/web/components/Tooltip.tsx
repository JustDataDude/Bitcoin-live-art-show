"use client";

import { useState, useRef, useEffect } from "react";

interface TooltipProps {
	children: React.ReactNode;
	content: string;
	position?: "top" | "bottom" | "left" | "right";
	delay?: number;
}

export function Tooltip({ children, content, position = "top", delay = 300 }: TooltipProps) {
	const [isVisible, setIsVisible] = useState(false);
	const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLDivElement>(null);

	const showTooltip = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			if (triggerRef.current && tooltipRef.current) {
				const triggerRect = triggerRef.current.getBoundingClientRect();
				const tooltipRect = tooltipRef.current.getBoundingClientRect();
				
				let top = 0;
				let left = 0;
				
				switch (position) {
					case "top":
						top = triggerRect.top - tooltipRect.height - 8;
						left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
						break;
					case "bottom":
						top = triggerRect.bottom + 8;
						left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
						break;
					case "left":
						top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
						left = triggerRect.left - tooltipRect.width - 8;
						break;
					case "right":
						top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
						left = triggerRect.right + 8;
						break;
				}
				
				setTooltipPosition({ top, left });
				setIsVisible(true);
			}
		}, delay);
	};

	const hideTooltip = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		setIsVisible(false);
	};

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return (
		<div
			ref={triggerRef}
			className="relative inline-block"
			onMouseEnter={showTooltip}
			onMouseLeave={hideTooltip}
			onFocus={showTooltip}
			onBlur={hideTooltip}
		>
			{children}
			{isVisible && (
				<div
					ref={tooltipRef}
					className="absolute z-50 px-3 py-2 text-sm text-white bg-slate-900 rounded-lg shadow-lg border border-slate-700 pointer-events-none whitespace-nowrap"
					style={{
						top: `${tooltipPosition.top}px`,
						left: `${tooltipPosition.left}px`,
					}}
					role="tooltip"
				>
					{content}
					<div
						className={`absolute w-2 h-2 bg-slate-900 border-slate-700 ${
							position === "top" ? "bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b rotate-45" :
							position === "bottom" ? "top-[-4px] left-1/2 -translate-x-1/2 border-l border-t rotate-45" :
							position === "left" ? "right-[-4px] top-1/2 -translate-y-1/2 border-r border-t rotate-45" :
							"left-[-4px] top-1/2 -translate-y-1/2 border-l border-b rotate-45"
						}`}
					/>
				</div>
			)}
		</div>
	);
}

