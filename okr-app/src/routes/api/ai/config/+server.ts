import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { userAiConfig } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { PROVIDER_DEFAULTS, type AiProvider } from '$lib/server/ai/providers';

function maskApiKey(key: string): string {
	if (key.length > 8) return '***' + key.slice(-4);
	return '***';
}

// GET /api/ai/config - Get current AI config (masked keys)
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const config = await db.query.userAiConfig.findFirst({
		where: eq(userAiConfig.userId, locals.user.id)
	});

	if (!config) {
		return json({ config: null, providerDefaults: PROVIDER_DEFAULTS });
	}

	// Mask API keys
	const providersConfig: Record<string, Record<string, string>> = config.providersConfig
		? JSON.parse(config.providersConfig)
		: {};

	const masked: Record<string, Record<string, string>> = {};
	for (const [provider, conf] of Object.entries(providersConfig)) {
		masked[provider] = { ...conf };
		if (masked[provider].apiKey) {
			masked[provider].apiKey = maskApiKey(masked[provider].apiKey);
		}
	}

	return json({
		config: {
			provider: config.provider,
			providersConfig: masked,
			customSystemPrompt: config.customSystemPrompt
		},
		providerDefaults: PROVIDER_DEFAULTS
	});
};

// PUT /api/ai/config - Save AI configuration
export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			provider,
			providerConfig,
			customSystemPrompt
		} = body as {
			provider?: AiProvider;
			providerConfig?: { apiKey?: string; model?: string; baseUrl?: string };
			customSystemPrompt?: string | null;
		};

		// Get existing config
		const existing = await db.query.userAiConfig.findFirst({
			where: eq(userAiConfig.userId, locals.user.id)
		});

		const existingProvidersConfig: Record<string, Record<string, string>> = existing?.providersConfig
			? JSON.parse(existing.providersConfig)
			: {};

		// Merge provider config (only update the specific provider being configured)
		if (provider && providerConfig) {
			const existingProviderConf = existingProvidersConfig[provider] || {};
			const merged = { ...existingProviderConf };

			// Only update fields that are provided and non-empty
			if (providerConfig.apiKey !== undefined && providerConfig.apiKey !== '') {
				merged.apiKey = providerConfig.apiKey;
			}
			// Allow clearing model/baseUrl by setting empty string, or updating
			if (providerConfig.model !== undefined) {
				if (providerConfig.model === '') {
					delete merged.model;
				} else {
					merged.model = providerConfig.model;
				}
			}
			if (providerConfig.baseUrl !== undefined) {
				if (providerConfig.baseUrl === '') {
					delete merged.baseUrl;
				} else {
					merged.baseUrl = providerConfig.baseUrl;
				}
			}

			existingProvidersConfig[provider] = merged;
		}

		const activeProvider = provider || existing?.provider || 'anthropic';
		const systemPrompt = customSystemPrompt !== undefined
			? (customSystemPrompt || null) // empty string becomes null
			: (existing?.customSystemPrompt || null);

		if (existing) {
			await db
				.update(userAiConfig)
				.set({
					provider: activeProvider,
					providersConfig: JSON.stringify(existingProvidersConfig),
					customSystemPrompt: systemPrompt,
					updatedAt: new Date()
				})
				.where(eq(userAiConfig.id, existing.id));
		} else {
			await db.insert(userAiConfig).values({
				id: uuidv4(),
				userId: locals.user.id,
				provider: activeProvider,
				providersConfig: JSON.stringify(existingProvidersConfig),
				customSystemPrompt: systemPrompt,
				createdAt: new Date(),
				updatedAt: new Date()
			});
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error saving AI config:', error);
		return json({ error: 'Failed to save AI configuration' }, { status: 500 });
	}
};
