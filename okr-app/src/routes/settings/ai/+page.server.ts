import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { userAiConfig } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { PROVIDER_DEFAULTS } from '$lib/server/ai/providers';

function maskApiKey(key: string): string {
	if (key.length > 8) return '***' + key.slice(-4);
	return '***';
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const config = await db.query.userAiConfig.findFirst({
		where: eq(userAiConfig.userId, locals.user.id)
	});

	// Mask API keys for client-side display
	let maskedProvidersConfig: Record<string, Record<string, string>> | null = null;
	if (config?.providersConfig) {
		const parsed: Record<string, Record<string, string>> = JSON.parse(config.providersConfig);
		maskedProvidersConfig = {};
		for (const [provider, conf] of Object.entries(parsed)) {
			maskedProvidersConfig[provider] = { ...conf };
			if (maskedProvidersConfig[provider].apiKey) {
				maskedProvidersConfig[provider].apiKeyMasked = maskApiKey(
					maskedProvidersConfig[provider].apiKey
				);
				delete maskedProvidersConfig[provider].apiKey;
			}
		}
	}

	return {
		aiConfig: config
			? {
					provider: config.provider,
					providersConfig: maskedProvidersConfig,
					customSystemPrompt: config.customSystemPrompt
				}
			: null,
		providerDefaults: PROVIDER_DEFAULTS
	};
};
