import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { savedQueries, userAiConfig } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, depends }) => {
	// Register dependency for invalidation
	depends('data:queries');

	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const queries = await db.query.savedQueries.findMany({
		where: eq(savedQueries.userId, locals.user.id)
	});

	// Load AI config for the chat panel
	const aiConfig = await db.query.userAiConfig.findFirst({
		where: eq(userAiConfig.userId, locals.user.id)
	});

	const providersConfig: Record<string, { apiKey?: string; model?: string; baseUrl?: string }> =
		aiConfig?.providersConfig ? JSON.parse(aiConfig.providersConfig) : {};
	const configuredProviders = Object.entries(providersConfig)
		.filter(([key, conf]) => conf.apiKey || key === 'ollama')
		.map(([name]) => name);

	return {
		savedQueries: queries,
		hasAiConfig: configuredProviders.length > 0,
		configuredProviders,
		activeProvider: aiConfig?.provider || 'anthropic'
	};
};
