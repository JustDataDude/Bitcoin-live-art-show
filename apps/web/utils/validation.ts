/**
 * Input Validation & Sanitization Utilities
 * Prevents XSS, injection attacks, and invalid data
 */

// Sanitize HTML to prevent XSS (simple approach without external dependency)
export function sanitizeHtml(html: string): string {
  // Remove all HTML tags
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[#\w]+;/g, '') // Remove HTML entities
    .trim();
}

// Sanitize text input (remove HTML, trim, limit length)
export function sanitizeText(text: string, maxLength: number = 500): string {
  if (typeof text !== 'string') {
    return '';
  }
  
  // Remove HTML tags
  let sanitized = sanitizeHtml(text);
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

// Validate bid amount
export interface BidValidationResult {
  valid: boolean;
  error?: string;
  amount?: number;
}

export function validateBid(amount: number | string): BidValidationResult {
  // Convert to number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Check if it's a valid number
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return { valid: false, error: 'Please enter a valid number' };
  }
  
  // Check minimum bid
  if (numAmount < 1) {
    return { valid: false, error: 'Minimum bid is $1' };
  }
  
  // Check maximum bid (prevent overflow/abuse)
  if (numAmount > 1000000) {
    return { valid: false, error: 'Maximum bid is $1,000,000' };
  }
  
  // Round to 2 decimal places
  const rounded = Math.round(numAmount * 100) / 100;
  
  return { valid: true, amount: rounded };
}

// Validate tip amount
export interface TipValidationResult {
  valid: boolean;
  error?: string;
  amount?: number;
}

export function validateTip(amount: number | string): TipValidationResult {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return { valid: false, error: 'Please enter a valid number' };
  }
  
  if (numAmount < 0.01) {
    return { valid: false, error: 'Minimum tip is $0.01' };
  }
  
  if (numAmount > 10000) {
    return { valid: false, error: 'Maximum tip is $10,000' };
  }
  
  const rounded = Math.round(numAmount * 100) / 100;
  
  return { valid: true, amount: rounded };
}

// Validate chat message
export interface MessageValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

export function validateMessage(message: string): MessageValidationResult {
  if (typeof message !== 'string') {
    return { valid: false, error: 'Message must be text' };
  }
  
  // Sanitize and trim
  const sanitized = sanitizeText(message, 500);
  
  // Check if empty after sanitization
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  // Check minimum length
  if (sanitized.length < 1) {
    return { valid: false, error: 'Message is too short' };
  }
  
  // Check for only whitespace
  if (!sanitized.trim()) {
    return { valid: false, error: 'Message cannot be only spaces' };
  }
  
  return { valid: true, message: sanitized };
}

// Validate username
export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
  username?: string;
}

export function validateUsername(username: string): UsernameValidationResult {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be text' };
  }
  
  const sanitized = sanitizeText(username, 50);
  
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, error: 'Username cannot be empty' };
  }
  
  if (sanitized.length < 2) {
    return { valid: false, error: 'Username must be at least 2 characters' };
  }
  
  if (sanitized.length > 50) {
    return { valid: false, error: 'Username must be 50 characters or less' };
  }
  
  // Check for profanity/inappropriate content (basic check)
  const profanityPattern = /(fuck|shit|damn|bitch|asshole)/i;
  if (profanityPattern.test(sanitized)) {
    return { valid: false, error: 'Username contains inappropriate content' };
  }
  
  return { valid: true, username: sanitized };
}

// Validate Bitcoin address
export function isValidBitcoinAddress(address: string, network: 'mainnet' | 'testnet' = 'mainnet'): boolean {
  if (typeof address !== 'string' || address.length === 0) {
    return false;
  }
  
  // Basic format validation
  // Mainnet addresses: start with 1, 3, or bc1
  // Testnet addresses: start with m, n, 2, or tb1
  if (network === 'mainnet') {
    return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
  } else {
    return /^(m|n|2|tb1)[a-zA-Z0-9]{25,62}$/.test(address);
  }
}

// Rate limiting helper (client-side, server should also enforce)
export class RateLimiter {
  private actions: Map<string, number[]> = new Map();
  private maxActions: number;
  private timeWindow: number; // in milliseconds

  constructor(maxActions: number, timeWindowMs: number) {
    this.maxActions = maxActions;
    this.timeWindow = timeWindowMs;
  }

  canPerform(key: string): boolean {
    const now = Date.now();
    const timestamps = this.actions.get(key) || [];
    
    // Remove old timestamps outside the time window
    const recent = timestamps.filter(ts => now - ts < this.timeWindow);
    
    if (recent.length >= this.maxActions) {
      return false;
    }
    
    // Add current timestamp
    recent.push(now);
    this.actions.set(key, recent);
    
    return true;
  }

  getTimeUntilNext(key: string): number {
    const timestamps = this.actions.get(key) || [];
    if (timestamps.length === 0) return 0;
    
    const oldest = Math.min(...timestamps);
    const elapsed = Date.now() - oldest;
    const remaining = this.timeWindow - elapsed;
    
    return Math.max(0, remaining);
  }

  reset(key: string): void {
    this.actions.delete(key);
  }
}

