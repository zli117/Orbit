import type { LayoutServerLoad } from './$types';
import { db } from '$lib/db/client';
import { userAiConfig } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	let aiConfig = {
		hasAiConfig: false,
		configuredProviders: [] as string[],
		activeProvider: 'anthropic'
	};

	if (locals.user) {
		const config = await db.query.userAiConfig.findFirst({
			where: eq(userAiConfig.userId, locals.user.id)
		});

		if (config) {
			const providersConfig: Record<string, { apiKey?: string }> =
				config.providersConfig ? JSON.parse(config.providersConfig) : {};
			const configuredProviders = Object.entries(providersConfig)
				.filter(([key, conf]) => conf.apiKey || key === 'ollama')
				.map(([name]) => name);

			aiConfig = {
				hasAiConfig: configuredProviders.length > 0,
				configuredProviders,
				activeProvider: config.provider || 'anthropic'
			};
		}
	}

	return {
		user: locals.user ?? null,
		aiConfig
	};
};
