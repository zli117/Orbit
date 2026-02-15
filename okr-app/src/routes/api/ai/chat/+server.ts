import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { userAiConfig } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendMessage, PROVIDER_DEFAULTS, type AiMessage, type AiProvider } from '$lib/server/ai/providers';
import { buildSystemPrompt } from '$lib/server/ai/system-prompt';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { messages, provider: overrideProvider } = body as {
			messages: AiMessage[];
			provider?: AiProvider;
		};

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return json({ error: 'Messages are required' }, { status: 400 });
		}

		// Get user's AI config
		const config = await db.query.userAiConfig.findFirst({
			where: eq(userAiConfig.userId, locals.user.id)
		});

		if (!config) {
			return json(
				{ error: 'AI not configured. Set up your AI provider in Settings → AI Assistant.' },
				{ status: 400 }
			);
		}

		const providersConfig: Record<string, { apiKey?: string; model?: string; baseUrl?: string }> =
			config.providersConfig ? JSON.parse(config.providersConfig) : {};

		// Use override provider if specified, otherwise use the default active provider
		const provider = overrideProvider || config.provider;
		const providerConfig = providersConfig[provider] || {};

		// Validate API key exists (except Ollama which may not need one)
		if (provider !== 'ollama' && !providerConfig.apiKey) {
			return json({ error: `API key not configured for ${PROVIDER_DEFAULTS[provider]?.label || provider}` }, { status: 400 });
		}

		// Apply defaults
		const defaults = PROVIDER_DEFAULTS[provider];
		const finalConfig = {
			...defaults,
			...providerConfig,
			model: providerConfig.model || defaults?.model
		};

		// Build system prompt
		const systemPrompt = await buildSystemPrompt(locals.user.id);

		// Send to provider
		const response = await sendMessage(provider, finalConfig, systemPrompt, messages);

		if (response.error) {
			return json({ error: response.error }, { status: 502 });
		}

		return json({ content: response.content });
	} catch (error) {
		console.error('AI chat error:', error);
		return json({ error: 'Failed to get AI response' }, { status: 500 });
	}
};
