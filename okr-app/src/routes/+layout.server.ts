import type { LayoutServerLoad } from './$types';
import { db } from '$lib/db/client';
import { userAiConfig } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	let aiConfig = {
		hasAiConfig: false,
		configuredProviders: [] as string[],
		activeProvider: 'anthropic',
		providerModels: {} as Record<string, string[]>
	};

	if (locals.user) {
		const config = await db.query.userAiConfig.findFirst({
			where: eq(userAiConfig.userId, locals.user.id)
		});

		if (config) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const providersConfig: Record<string, Record<string, any>> =
				config.providersConfig ? JSON.parse(config.providersConfig) : {};
			const configuredProviders = Object.entries(providersConfig)
				.filter(([key, conf]) => conf.apiKey || key === 'ollama')
				.map(([name]) => name);

			// Build provider → models mapping
			const providerModels: Record<string, string[]> = {};
			for (const [name, conf] of Object.entries(providersConfig)) {
				// Normalize old model → models
				const models: string[] = conf.models || (conf.model ? [conf.model] : []);
				if (models.length > 0) {
					providerModels[name] = models;
				}
			}

			aiConfig = {
				hasAiConfig: configuredProviders.length > 0,
				configuredProviders,
				activeProvider: config.provider || 'anthropic',
				providerModels
			};
		}
	}

	return {
		user: locals.user ?? null,
		aiConfig
	};
};
