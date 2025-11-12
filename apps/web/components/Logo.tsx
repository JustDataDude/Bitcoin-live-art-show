"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export function Logo({ size = "md", className = "", showText = false }: LogoProps) {
  const [imageError, setImageError] = useState(false);
  const [logoPath, setLogoPath] = useState<string>("/logo.png");

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-32 h-32",
    lg: "w-48 h-48",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  // List of possible logo file formats to try (PNG first since that's what user has)
  const possibleFormats = ["/logo.png", "/logo.svg", "/logo.jpg", "/logo.jpeg", "/logo.webp"];

  return (
    <Link 
      href="/" 
      className={`flex items-center gap-3 hover:opacity-80 transition-opacity ${className}`}
      aria-label="1 of 1's Game Show - Home"
    >
      {!imageError ? (
        <div className={`${sizeClasses[size]} relative flex-shrink-0 bg-transparent`}>
          <img
            src="/logo.png"
            alt="1 of 1's Game Show Logo"
            className="object-contain w-full h-full bg-transparent"
            style={{ mixBlendMode: 'normal' }}
            onError={(e) => {
              console.error("Logo image failed to load: /logo.png");
              setImageError(true);
            }}
            onLoad={() => {
              console.log("Logo image loaded successfully");
            }}
          />
        </div>
      ) : (
        // Fallback if logo not found - show text placeholder
        <div className={`${sizeClasses[size]} flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg`}>
          <span className="text-white font-bold text-xs">1:1</span>
        </div>
      )}
      {showText && (
        <span className={`font-bold gradient-text ${textSizes[size]}`}>
          1 of 1&apos;s Game Show
        </span>
      )}
    </Link>
  );
}

