#!/usr/bin/env tsx
/**
 * Validates that all required environment variables are set
 * Run this before deploying to production
 */

import { z } from 'zod';

const requiredEnvVars = {
	// Database
	DATABASE_URL: z.string().url(),
	REDIS_URL: z.string().url(),
	
	// WebSocket
	NEXT_PUBLIC_WS_URL: z.string().url().optional(),
	
	// WalletConnect
	NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1).optional(),
	
	// LiveKit (optional)
	LIVEKIT_URL: z.string().url().optional(),
	LIVEKIT_API_KEY: z.string().min(1).optional(),
	LIVEKIT_API_SECRET: z.string().min(1).optional(),
	
	// Environment
	NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
} as const;

const optionalEnvVars = {
	INSCRIBER_BTC_RECEIVE_ADDR: z.string().optional(),
	PLATFORM_FEE_BPS: z.string().optional(),
	CORS_ORIGIN: z.string().optional(),
} as const;

function validateEnv() {
	const errors: string[] = [];
	const warnings: string[] = [];

	console.log('🔍 Validating environment variables...\n');

	// Check required variables
	for (const [key, schema] of Object.entries(requiredEnvVars)) {
		const value = process.env[key];
		
		if (!value) {
			if (schema instanceof z.ZodOptional) {
				warnings.push(`⚠️  ${key} is not set (optional but recommended)`);
			} else {
				errors.push(`❌ ${key} is required but not set`);
			}
		} else {
			try {
				schema.parse(value);
				console.log(`✅ ${key} is set and valid`);
			} catch (error) {
				if (error instanceof z.ZodError) {
					errors.push(`❌ ${key} has invalid format: ${error.errors[0].message}`);
				}
			}
		}
	}

	// Check optional variables
	for (const [key, schema] of Object.entries(optionalEnvVars)) {
		const value = process.env[key];
		if (value) {
			try {
				schema.parse(value);
				console.log(`✅ ${key} is set`);
			} catch (error) {
				if (error instanceof z.ZodError) {
					warnings.push(`⚠️  ${key} has invalid format: ${error.errors[0].message}`);
				}
			}
		}
	}

	// Production-specific checks
	if (process.env.NODE_ENV === 'production') {
		console.log('\n🔒 Production-specific checks:');
		
		if (!process.env.NEXT_PUBLIC_WS_URL) {
			errors.push('❌ NEXT_PUBLIC_WS_URL is required in production');
		} else if (process.env.NEXT_PUBLIC_WS_URL?.includes('localhost')) {
			errors.push('❌ NEXT_PUBLIC_WS_URL should not point to localhost in production');
		}
		
		if (!process.env.CORS_ORIGIN) {
			warnings.push('⚠️  CORS_ORIGIN is not set - CORS will be disabled in production');
		}
		
		if (process.env.DATABASE_URL?.includes('sqlite')) {
			errors.push('❌ SQLite should not be used in production - use PostgreSQL');
		}
	}

	// Print results
	console.log('\n' + '='.repeat(50));
	
	if (warnings.length > 0) {
		console.log('\n⚠️  Warnings:');
		warnings.forEach(w => console.log(`  ${w}`));
	}
	
	if (errors.length > 0) {
		console.log('\n❌ Errors:');
		errors.forEach(e => console.log(`  ${e}`));
		console.log('\n❌ Validation failed! Please fix the errors above.');
		process.exit(1);
	}
	
	if (warnings.length === 0 && errors.length === 0) {
		console.log('\n✅ All environment variables are valid!');
	} else if (errors.length === 0) {
		console.log('\n✅ Validation passed with warnings.');
	}
}

validateEnv();

