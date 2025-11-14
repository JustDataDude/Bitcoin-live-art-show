"use client";

import { useState, useEffect } from "react";
import { Button } from "@live-art/ui";
import { validateUsername } from "../utils/validation";
import io, { Socket } from "socket.io-client";
import { showToast } from "./Toast";

interface UserLoginProps {
	onLogin?: (username: string, walletAddress?: string) => void;
}

// Validate EVM address (0x followed by 40 hex characters)
function isValidEVMAddress(address: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

// Validate Bitcoin address (basic check - starts with 1, 3, or bc1)
function isValidBitcoinAddress(address: string): boolean {
	const trimmed = address.trim();
	return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(trimmed);
}

export function UserLogin({ onLogin }: UserLoginProps) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [email, setEmail] = useState("");
	const [walletAddress, setWalletAddress] = useState("");
	const [walletChain, setWalletChain] = useState<"EVM" | "BTC">("EVM");
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [currentUsername, setCurrentUsername] = useState("");
	const [currentWallet, setCurrentWallet] = useState("");
	const [showLogin, setShowLogin] = useState(false);
	const [isLoginMode, setIsLoginMode] = useState(false); // false = sign up, true = login
	const [showForgotPassword, setShowForgotPassword] = useState(false);
	const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
	const [passwordSetupUsername, setPasswordSetupUsername] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isChecking, setIsChecking] = useState(false);
	const [socket, setSocket] = useState<Socket | null>(null);

	useEffect(() => {
		// Check if user is already logged in
		const savedUsername = localStorage.getItem("username");
		const savedWallet = localStorage.getItem("walletAddress");
		const savedChain = localStorage.getItem("walletChain") as "EVM" | "BTC" | null;
		
		console.log("[UserLogin] Checking saved login state:", { savedUsername, savedWallet, savedChain });
		
		if (savedUsername) {
			setCurrentUsername(savedUsername);
			if (savedWallet) {
				setCurrentWallet(savedWallet);
			}
			setIsLoggedIn(true);
			console.log("[UserLogin] Restored logged in state for:", savedUsername);
		}
		
		// Initialize WebSocket connection for registration
		const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4001";
		const socketInstance = io(wsUrl, {
			transports: ["polling", "websocket"],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		});
		
		socketInstance.on("connect", () => {
			console.log("[UserLogin] WebSocket connected");
		});
		
		socketInstance.on("connect_error", (error) => {
			console.error("[UserLogin] WebSocket connection error:", error);
		});
		
		socketInstance.on("user_registered", (data: { ok: boolean; username?: string; error?: string }) => {
			if (data.ok) {
				console.log("[UserLogin] User registered successfully:", data.username);
			} else {
				console.error("[UserLogin] User registration failed:", data.error);
				setError(data.error || "Registration failed");
				setIsChecking(false);
			}
		});
		
		socketInstance.on("username_taken", (data: { username: string }) => {
			console.error("[UserLogin] Username taken:", data.username);
			setError("Username is already taken. Please choose another.");
			setIsChecking(false);
		});
		
		setSocket(socketInstance);
		
		return () => {
			socketInstance.off("connect");
			socketInstance.off("connect_error");
			socketInstance.off("user_registered");
			socketInstance.off("username_taken");
			socketInstance.disconnect();
		};
	}, []);

	const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean> => {
		try {
			const response = await fetch("/api/auth/check-username", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: usernameToCheck }),
			});
			
			if (!response.ok) {
				console.error("[UserLogin] Username check failed:", response.status, response.statusText);
				return false;
			}
			
			const data = await response.json();
			return data.available === true;
		} catch (error) {
			console.error("[UserLogin] Error checking username:", error);
			return false;
		}
	};

	const handleLogin = async (e?: React.FormEvent<HTMLFormElement>) => {
		if (e) {
			e.preventDefault();
		}
		
		setError(null);
		setIsChecking(true);
		
		try {
			// Validate username
			if (!username.trim()) {
				setError("Please enter a username");
				setIsChecking(false);
				return;
			}

			const validation = validateUsername(username.trim());
			if (!validation.valid) {
				setError(validation.error || "Invalid username");
				setIsChecking(false);
				return;
			}

			const validUsername = validation.username || username.trim();
			
			// Validate password
			if (!password) {
				setError("Please enter a password");
				setIsChecking(false);
				return;
			}

			if (isLoginMode) {
				// Login: verify username and password
				const response = await fetch("/api/auth/login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						username: validUsername,
						password: password,
					}),
				});

				const data = await response.json();
				console.log("[UserLogin] Login response:", { status: response.status, success: data.success, error: data.error, needsPassword: data.needsPassword });
				
				if (!data.success) {
					// If account needs a password, switch to password setup mode
					if (data.needsPassword) {
						setPasswordSetupUsername(validUsername);
						setNeedsPasswordSetup(true);
						setError("This account doesn't have a password. Please set one below.");
						setIsChecking(false);
						return;
					}
					
					// Show specific error message
					const errorMessage = data.error || "Invalid username or password";
					console.error("[UserLogin] Login failed:", errorMessage);
					setError(errorMessage);
					setIsChecking(false);
					return;
				}

				// Login successful - get user data
				const user = data.user;
				
				// Save to localStorage
				localStorage.setItem("username", user.username);
				localStorage.setItem("userHandle", user.handle);
				if (walletAddress.trim()) {
					localStorage.setItem("walletAddress", walletAddress.trim());
					localStorage.setItem("walletChain", walletChain);
				}

				// Register with WebSocket server for real-time features
				if (socket) {
					if (socket.connected) {
						socket.emit("register_user", { 
							userHandle: user.handle, 
							username: user.username 
						});
						
						if (walletAddress.trim()) {
							socket.emit("register_wallet", {
								chain: walletChain,
								address: walletAddress.trim(),
								username: user.username,
							});
						}
					} else {
						socket.once("connect", () => {
							socket.emit("register_user", { 
								userHandle: user.handle, 
								username: user.username 
							});
							
							if (walletAddress.trim()) {
								socket.emit("register_wallet", {
									chain: walletChain,
									address: walletAddress.trim(),
									username: user.username,
								});
							}
						});
						if (!socket.connected) {
							socket.connect();
						}
					}
				}

				// Complete login
				setCurrentUsername(user.username);
				setCurrentWallet(walletAddress.trim() || "");
				setIsLoggedIn(true);
				setShowLogin(false);
				setUsername("");
				setPassword("");
				setConfirmPassword("");
				setEmail("");
				setWalletAddress("");
				setIsChecking(false);
				
				showToast(`Welcome back, ${user.username}!`, "success", 5000);
				
				if (onLogin) {
					onLogin(user.username, walletAddress.trim() || undefined);
				}
			} else {
				// Sign up: validate password and create account
				if (password.length < 8) {
					setError("Password must be at least 8 characters long");
					setIsChecking(false);
					return;
				}

				if (password !== confirmPassword) {
					setError("Passwords do not match");
					setIsChecking(false);
					return;
				}

				// Validate wallet address if provided
				if (walletAddress.trim()) {
					const isValid = walletChain === "EVM" 
						? isValidEVMAddress(walletAddress.trim())
						: isValidBitcoinAddress(walletAddress.trim());
					
					if (!isValid) {
						setError(`Invalid ${walletChain} address format`);
						setIsChecking(false);
						return;
					}
				}

				// Check username availability first (client-side check for better UX)
				const isAvailable = await checkUsernameAvailability(validUsername);
				if (!isAvailable) {
					setError("Username is already taken. Please choose another.");
					setIsChecking(false);
					return;
				}

				// Register new user
				const response = await fetch("/api/auth/register", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						username: validUsername,
						password: password,
						email: email.trim() || undefined,
						walletAddress: walletAddress.trim() || undefined,
						walletChain: walletChain,
					}),
				});

				const data = await response.json();
				console.log("[UserLogin] Registration response:", { status: response.status, success: data.success, user: data.user, error: data.error });
				
				if (!response.ok || !data.success) {
					const errorMessage = data.error || `Registration failed (${response.status}). Please check the server console for details.`;
					console.error("[UserLogin] Registration error:", data);
					setError(errorMessage);
					setIsChecking(false);
					return;
				}

				// Registration successful - get user data
				const user = data.user;
				
				if (!user || !user.username) {
					console.error("[UserLogin] Registration succeeded but user data is missing:", data);
					setError("Registration succeeded but user data is missing. Please try logging in.");
					setIsChecking(false);
					return;
				}
				
				console.log("[UserLogin] Registration successful, user:", user);
				
				// Save to localStorage
				localStorage.setItem("username", user.username);
				localStorage.setItem("userHandle", user.handle);
				if (walletAddress.trim()) {
					localStorage.setItem("walletAddress", walletAddress.trim());
					localStorage.setItem("walletChain", walletChain);
				}
				
				console.log("[UserLogin] Saved to localStorage:", {
					username: user.username,
					handle: user.handle,
					wallet: walletAddress.trim() || "none"
				});

				// Register with WebSocket server for real-time features
				if (socket) {
					if (socket.connected) {
						console.log("[UserLogin] Registering user with WebSocket server");
						socket.emit("register_user", { 
							userHandle: user.handle, 
							username: user.username 
						});
						
						if (walletAddress.trim()) {
							socket.emit("register_wallet", {
								chain: walletChain,
								address: walletAddress.trim(),
								username: user.username,
							});
						}
					} else {
						console.log("[UserLogin] WebSocket not connected, waiting for connection");
						socket.once("connect", () => {
							console.log("[UserLogin] WebSocket connected, registering user");
							socket.emit("register_user", { 
								userHandle: user.handle, 
								username: user.username 
							});
							
							if (walletAddress.trim()) {
								socket.emit("register_wallet", {
									chain: walletChain,
									address: walletAddress.trim(),
									username: user.username,
								});
							}
						});
						if (!socket.connected) {
							socket.connect();
						}
					}
				}

				// Complete registration - update state
				console.log("[UserLogin] Setting logged in state for:", user.username);
				setCurrentUsername(user.username);
				setCurrentWallet(walletAddress.trim() || "");
				setIsLoggedIn(true);
				setShowLogin(false);
				setUsername("");
				setPassword("");
				setConfirmPassword("");
				setEmail("");
				setWalletAddress("");
				setIsChecking(false);
				
				console.log("[UserLogin] State updated, showing success toast");
				showToast(`Account created successfully! Welcome, ${user.username}!`, "success", 5000);
				
				if (onLogin) {
					onLogin(user.username, walletAddress.trim() || undefined);
				}
			}
		} catch (error) {
			console.error("Error during login:", error);
			setError("An error occurred. Please try again.");
			setIsChecking(false);
		}
	};

	const handleLogout = () => {
		localStorage.removeItem("username");
		localStorage.removeItem("userHandle");
		localStorage.removeItem("walletAddress");
		localStorage.removeItem("walletChain");
		setIsLoggedIn(false);
		setCurrentUsername("");
		setCurrentWallet("");
		setShowLogin(false);
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			if (needsPasswordSetup) {
				handleSetPassword();
			} else {
				handleLogin();
			}
		}
	};

	const handleSetPassword = async () => {
		if (!password || password.length < 8) {
			setError("Password must be at least 8 characters long");
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setIsChecking(true);
		setError(null);

		try {
			const response = await fetch("/api/auth/set-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: passwordSetupUsername,
					password: password,
				}),
			});

			const data = await response.json();
			console.log("[UserLogin] Set password response:", data);

			if (!data.success) {
				setError(data.error || "Failed to set password");
				setIsChecking(false);
				return;
			}

			// Password set successfully - now log them in
			showToast("Password set successfully! Logging you in...", "success", 3000);
			
			// Automatically log them in after setting password
			const loginResponse = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: passwordSetupUsername,
					password: password,
				}),
			});

			const loginData = await loginResponse.json();
			
			if (loginData.success) {
				const user = loginData.user;
				localStorage.setItem("username", user.username);
				localStorage.setItem("userHandle", user.handle);
				
				setCurrentUsername(user.username);
				setCurrentWallet("");
				setIsLoggedIn(true);
				setNeedsPasswordSetup(false);
				setPasswordSetupUsername("");
				setShowLogin(false);
				setPassword("");
				setConfirmPassword("");
				setIsChecking(false);
				
				showToast(`Welcome, ${user.username}!`, "success", 5000);
				
				if (onLogin) {
					onLogin(user.username, undefined);
				}
			} else {
				setError("Password set but login failed. Please try logging in manually.");
				setIsChecking(false);
			}
		} catch (error) {
			console.error("[UserLogin] Error setting password:", error);
			setError("An error occurred. Please try again.");
			setIsChecking(false);
		}
	};

	// Debug: Log state changes
	useEffect(() => {
		console.log("[UserLogin] State changed:", { isLoggedIn, currentUsername, showLogin });
	}, [isLoggedIn, currentUsername, showLogin]);

	if (isLoggedIn) {
		console.log("[UserLogin] Rendering logged in button for:", currentUsername);
		return (
			<Button
				variant="ghost"
				size="lg"
				onClick={handleLogout}
				className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-[0_20px_45px_-15px_rgba(168,85,247,0.6)] border border-purple-300/60 transition-transform hover:scale-[1.05] hover:shadow-[0_25px_65px_-18px_rgba(168,85,247,0.7)] whitespace-nowrap"
			>
				👤 {currentUsername}
			</Button>
		);
	}

	if (showLogin) {
		return (
			<>
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
					<div className="glass rounded-2xl p-6 border border-white/20 backdrop-blur-xl max-w-md w-full relative">
						{/* Close button */}
						<button
							onClick={() => {
								setShowLogin(false);
								setUsername("");
								setPassword("");
								setConfirmPassword("");
								setEmail("");
								setWalletAddress("");
								setError(null);
							}}
							className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all hover:scale-110"
							aria-label="Close login form"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fillRule="evenodd"
									d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
									clipRule="evenodd"
								/>
							</svg>
						</button>
						
						<h2 className="text-2xl font-bold text-white mb-4 pr-8">
							{isLoginMode ? "Welcome Back!" : "Welcome to 1 of 1&apos;s Game Show"}
						</h2>
						
						{/* Toggle between Sign Up and Login */}
						<div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-lg border border-white/10">
							<button
								type="button"
								onClick={() => {
									setIsLoginMode(false);
									setError(null);
									setUsername("");
									setPassword("");
									setConfirmPassword("");
									setEmail("");
									setWalletAddress("");
								}}
								className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
									!isLoginMode
										? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
										: "text-slate-400 hover:text-white"
								}`}
							>
								Sign Up
							</button>
							<button
								type="button"
								onClick={() => {
									setIsLoginMode(true);
									setError(null);
									setUsername("");
									setPassword("");
									setConfirmPassword("");
									setEmail("");
									setWalletAddress("");
								}}
								className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
									isLoginMode
										? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
										: "text-slate-400 hover:text-white"
								}`}
							>
								Login
							</button>
						</div>
						
						<p className="text-slate-300 mb-6 text-sm">
							{isLoginMode
								? "Enter your username to log in to your account."
								: "Create your account with a unique username and optional wallet address. Your username will be displayed in chat, bids, and tips."}
						</p>
						
						<form 
							onSubmit={handleLogin}
							className="space-y-4"
							autoComplete={isLoginMode ? "on" : "off"}
						>
							<div>
								<label htmlFor="login-username" className="block text-sm font-medium text-slate-200 mb-2">
									Username <span className="text-red-400">*</span>
								</label>
								<input
									id="login-username"
									type="text"
									name="username"
									value={username}
									onChange={(e) => {
										setUsername(e.target.value);
										setError(null);
									}}
									onKeyPress={handleKeyPress}
									placeholder="Enter your username"
									autoComplete="username"
									className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
									maxLength={50}
									required
									autoFocus
								/>
								{error && error.includes("username") && (
									<p className="mt-2 text-sm text-red-400">{error}</p>
								)}
								<p className="mt-2 text-xs text-slate-400">
									2-50 characters, letters, numbers, and spaces only. Must be unique.
								</p>
							</div>
							
							{/* Password field */}
							<div>
								<label htmlFor="login-password" className="block text-sm font-medium text-slate-200 mb-2">
									Password <span className="text-red-400">*</span>
								</label>
								<input
									id="login-password"
									type="password"
									value={password}
									onChange={(e) => {
										setPassword(e.target.value);
										setError(null);
									}}
									onKeyPress={handleKeyPress}
									placeholder="Enter your password"
									autoComplete={isLoginMode ? "current-password" : "new-password"}
									className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
									required
								/>
								{error && error.includes("password") && (
									<p className="mt-2 text-sm text-red-400">{error}</p>
								)}
								{!isLoginMode && (
									<p className="mt-2 text-xs text-slate-400">
										Must be at least 8 characters long.
									</p>
								)}
							</div>
							
							{/* Confirm Password (Sign Up only) */}
							{!isLoginMode && (
								<div>
									<label htmlFor="confirm-password" className="block text-sm font-medium text-slate-200 mb-2">
										Confirm Password <span className="text-red-400">*</span>
									</label>
									<input
										id="confirm-password"
										type="password"
										value={confirmPassword}
										onChange={(e) => {
											setConfirmPassword(e.target.value);
											setError(null);
										}}
										placeholder="Confirm your password"
										autoComplete="new-password"
										className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
										required
									/>
									{error && error.includes("match") && (
										<p className="mt-2 text-sm text-red-400">{error}</p>
									)}
								</div>
							)}
							
							{/* Email field (Sign Up only, optional) */}
							{!isLoginMode && (
								<div>
									<label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
										Email (Optional - for password recovery)
									</label>
									<input
										id="email"
										type="email"
										value={email}
										onChange={(e) => {
											setEmail(e.target.value);
											setError(null);
										}}
										placeholder="your@email.com"
										autoComplete="email"
										className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
									/>
									<p className="mt-2 text-xs text-slate-400">
										Optional. Used for password recovery if you forget your password.
									</p>
								</div>
							)}
							
							{/* Forgot Password link (Login only, and not in password setup mode) */}
							{isLoginMode && !needsPasswordSetup && (
								<div className="text-right">
									<button
										type="button"
										onClick={() => {
											setShowForgotPassword(true);
											setError(null);
										}}
										className="text-sm text-emerald-400 hover:text-emerald-300 underline"
									>
										Forgot password?
									</button>
								</div>
							)}
							
							{/* Password Setup Mode (when account has no password) */}
							{needsPasswordSetup && (
								<div className="space-y-4 pt-4 border-t border-white/10">
									<p className="text-sm text-slate-300">
										Your account doesn't have a password yet. Please set one below to continue.
									</p>
									<div>
										<label htmlFor="setup-password" className="block text-sm font-medium text-slate-200 mb-2">
											New Password <span className="text-red-400">*</span>
										</label>
										<input
											id="setup-password"
											type="password"
											value={password}
											onChange={(e) => {
												setPassword(e.target.value);
												setError(null);
											}}
											placeholder="Enter your new password"
											autoComplete="new-password"
											className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
											required
										/>
										<p className="mt-2 text-xs text-slate-400">
											Must be at least 8 characters long.
										</p>
									</div>
									<div>
										<label htmlFor="setup-confirm-password" className="block text-sm font-medium text-slate-200 mb-2">
											Confirm Password <span className="text-red-400">*</span>
										</label>
										<input
											id="setup-confirm-password"
											type="password"
											value={confirmPassword}
											onChange={(e) => {
												setConfirmPassword(e.target.value);
												setError(null);
											}}
											placeholder="Confirm your new password"
											autoComplete="new-password"
											className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
											required
										/>
									</div>
								</div>
							)}
							
							{!isLoginMode && (
								<>
									<div>
										<label htmlFor="wallet-chain" className="block text-sm font-medium text-slate-200 mb-2">
											Wallet Chain (Optional)
										</label>
										<select
											id="wallet-chain"
											value={walletChain}
											onChange={(e) => setWalletChain(e.target.value as "EVM" | "BTC")}
											className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
										>
											<option value="EVM" className="bg-slate-800">EVM (Ethereum, Polygon, etc.)</option>
											<option value="BTC" className="bg-slate-800">Bitcoin</option>
										</select>
									</div>
									
									<div>
										<label htmlFor="wallet-address" className="block text-sm font-medium text-slate-200 mb-2">
											Wallet Address (Optional)
										</label>
										<input
											id="wallet-address"
											type="text"
											value={walletAddress}
											onChange={(e) => {
												setWalletAddress(e.target.value);
												setError(null);
											}}
											placeholder={walletChain === "EVM" ? "0x..." : "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"}
											className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all font-mono text-sm"
										/>
										{error && (error.includes("address") || error.includes("Address")) && (
											<p className="mt-2 text-sm text-red-400">{error}</p>
										)}
										<p className="mt-2 text-xs text-slate-400">
											{walletChain === "EVM" 
												? "EVM address format: 0x followed by 40 hex characters"
												: "Bitcoin address format: starts with 1, 3, or bc1"}
										</p>
									</div>
								</>
							)}
							
							<div className="flex gap-3 pt-2">
								<Button
									type={needsPasswordSetup ? "button" : "submit"}
									onClick={needsPasswordSetup ? handleSetPassword : undefined}
									disabled={isChecking}
									className="flex-1 bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-900 font-bold hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isChecking 
										? (needsPasswordSetup ? "Setting password..." : (isLoginMode ? "Logging in..." : "Checking..."))
										: (needsPasswordSetup ? "Set Password" : (isLoginMode ? "Login" : "Create Account"))}
								</Button>
								<Button
									type="button"
									variant="ghost"
									onClick={() => {
										setShowLogin(false);
										setUsername("");
										setPassword("");
										setConfirmPassword("");
										setEmail("");
										setWalletAddress("");
										setError(null);
									}}
									className="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/30 hover:border-red-500/50"
								>
									Cancel
								</Button>
							</div>
						</form>
					</div>
				</div>
			</>
		);
	}

	return (
		<Button
			onClick={() => setShowLogin(true)}
			size="lg"
			className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-[0_20px_45px_-15px_rgba(168,85,247,0.6)] border border-purple-300/60 transition-transform hover:scale-[1.05] hover:shadow-[0_25px_65px_-18px_rgba(168,85,247,0.7)] whitespace-nowrap"
		>
			👤 Login / Sign Up
		</Button>
	);
}

