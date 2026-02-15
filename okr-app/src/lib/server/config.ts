/**
 * System Configuration Service
 * Reads/writes admin-configurable settings from the database
 * with in-memory caching and environment variable fallback.
 */

import { db } from '$lib/db/client';
import { systemConfig } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { AdminConfigField } from './plugins/types';

// In-memory cache
let cache: Map<string, string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

// Environment variable fallback mapping: DB key → env var name
const ENV_FALLBACKS: Record<string, () => string | undefined> = {
	'global.base_url': () => env.PUBLIC_BASE_URL,
	'plugin.fitbit.client_id': () => env.FITBIT_CLIENT_ID,
	'plugin.fitbit.client_secret': () => env.FITBIT_CLIENT_SECRET
};

/**
 * Global config fields that can be set by admin
 */
export const GLOBAL_CONFIG_FIELDS: AdminConfigField[] = [
	{
		key: 'base_url',
		label: 'Public Base URL',
		description: 'The public URL of this application (used for OAuth callback URLs)',
		type: 'url',
		required: false,
		placeholder: 'https://okr.example.com'
	}
];

async function loadCache(): Promise<Map<string, string>> {
	if (cache && Date.now() < cacheExpiry) return cache;

	const rows = await db.select().from(systemConfig);
	cache = new Map(rows.map((r) => [r.key, r.value]));
	cacheExpiry = Date.now() + CACHE_TTL_MS;
	return cache;
}

function invalidateCache(): void {
	cache = null;
	cacheExpiry = 0;
}

/**
 * Get a single config value. Checks DB first, then falls back to env var.
 */
export async function getConfigValue(key: string): Promise<string | undefined> {
	const c = await loadCache();
	const dbValue = c.get(key);
	if (dbValue !== undefined) return dbValue;

	const fallback = ENV_FALLBACKS[key];
	return fallback ? fallback() : undefined;
}

/**
 * Get all config values for a plugin (keys matching `plugin.{pluginId}.*`)
 */
export async function getPluginConfigValues(pluginId: string): Promise<Record<string, string>> {
	const prefix = `plugin.${pluginId}.`;
	const c = await loadCache();
	const result: Record<string, string> = {};

	for (const [k, v] of c.entries()) {
		if (k.startsWith(prefix)) {
			const shortKey = k.slice(prefix.length);
			result[shortKey] = v;
		}
	}

	// Fill in env var fallbacks not already in DB
	for (const [k, getFallback] of Object.entries(ENV_FALLBACKS)) {
		if (k.startsWith(prefix)) {
			const shortKey = k.slice(prefix.length);
			if (!result[shortKey]) {
				const val = getFallback();
				if (val) result[shortKey] = val;
			}
		}
	}

	return result;
}

/**
 * Set a config value (upsert)
 */
export async function setConfigValue(
	key: string,
	value: string,
	isSecret: boolean
): Promise<void> {
	const existing = await db.select().from(systemConfig).where(eq(systemConfig.key, key));

	if (existing.length > 0) {
		await db
			.update(systemConfig)
			.set({ value, isSecret, updatedAt: new Date() })
			.where(eq(systemConfig.key, key));
	} else {
		await db.insert(systemConfig).values({
			key,
			value,
			isSecret,
			updatedAt: new Date()
		});
	}

	invalidateCache();
}

/**
 * Get all config entries for the admin UI. Secret values are masked.
 */
export async function getAllConfig(): Promise<Array<{ key: string; value: string; isSecret: boolean }>> {
	const rows = await db.select().from(systemConfig);
	return rows.map((r) => ({
		key: r.key,
		value: r.isSecret ? '' : r.value,
		isSecret: r.isSecret
	}));
}

/**
 * Check if a secret key has a value set (without revealing the value)
 */
export async function hasConfigValue(key: string): Promise<boolean> {
	const c = await loadCache();
	if (c.has(key)) return true;

	const fallback = ENV_FALLBACKS[key];
	return fallback ? !!fallback() : false;
}

export { invalidateCache };
