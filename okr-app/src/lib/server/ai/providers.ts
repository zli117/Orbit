/**
 * AI Provider Abstraction
 * Unified interface for calling different LLM providers using plain fetch().
 */

export interface AiMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface AiProviderConfig {
	apiKey?: string;
	model?: string;
	baseUrl?: string;
}

export interface AiResponse {
	content: string;
	error?: string;
}

export type AiProvider = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'ollama';

export const PROVIDER_DEFAULTS: Record<AiProvider, { model?: string; baseUrl?: string; label: string }> = {
	anthropic: { model: 'claude-sonnet-4-5-20250929', label: 'Anthropic' },
	openai: { model: 'gpt-4o', label: 'OpenAI' },
	gemini: { model: 'gemini-2.0-flash', label: 'Gemini' },
	openrouter: { label: 'OpenRouter' },
	ollama: { baseUrl: 'http://localhost:11434', label: 'Ollama' }
};

const TIMEOUT_MS = 60_000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(url, { ...options, signal: controller.signal });
		return response;
	} finally {
		clearTimeout(timeoutId);
	}
}

async function sendAnthropicMessage(
	config: AiProviderConfig,
	systemPrompt: string,
	messages: AiMessage[]
): Promise<AiResponse> {
	const model = config.model || PROVIDER_DEFAULTS.anthropic.model!;

	const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': config.apiKey!,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model,
			max_tokens: 4096,
			system: systemPrompt,
			messages: messages.map((m) => ({ role: m.role, content: m.content }))
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		if (response.status === 401) return { content: '', error: 'Invalid Anthropic API key' };
		if (response.status === 429) return { content: '', error: 'Rate limit exceeded. Try again later.' };
		return { content: '', error: (error as { error?: { message?: string } }).error?.message || `Anthropic error: ${response.status}` };
	}

	const data = await response.json();
	const text = (data as { content?: { type: string; text: string }[] }).content?.[0]?.text || '';
	return { content: text };
}

async function sendOpenAiMessage(
	config: AiProviderConfig,
	systemPrompt: string,
	messages: AiMessage[],
	baseUrl = 'https://api.openai.com'
): Promise<AiResponse> {
	const model = config.model || PROVIDER_DEFAULTS.openai.model!;

	const response = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.apiKey}`
		},
		body: JSON.stringify({
			model,
			max_tokens: 4096,
			messages: [
				{ role: 'system', content: systemPrompt },
				...messages.map((m) => ({ role: m.role, content: m.content }))
			]
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		if (response.status === 401) return { content: '', error: 'Invalid API key' };
		if (response.status === 429) return { content: '', error: 'Rate limit exceeded. Try again later.' };
		return { content: '', error: (error as { error?: { message?: string } }).error?.message || `API error: ${response.status}` };
	}

	const data = await response.json();
	const text = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content || '';
	return { content: text };
}

async function sendGeminiMessage(
	config: AiProviderConfig,
	systemPrompt: string,
	messages: AiMessage[]
): Promise<AiResponse> {
	const model = config.model || PROVIDER_DEFAULTS.gemini.model!;

	// Convert messages to Gemini format
	const contents = messages.map((m) => ({
		role: m.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	const response = await fetchWithTimeout(
		`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: systemPrompt }] },
				contents
			})
		}
	);

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		if (response.status === 400 || response.status === 403) return { content: '', error: 'Invalid Gemini API key or model' };
		if (response.status === 429) return { content: '', error: 'Rate limit exceeded. Try again later.' };
		return { content: '', error: (error as { error?: { message?: string } }).error?.message || `Gemini error: ${response.status}` };
	}

	const data = await response.json();
	const text = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts?.[0]?.text || '';
	return { content: text };
}

async function sendOpenRouterMessage(
	config: AiProviderConfig,
	systemPrompt: string,
	messages: AiMessage[]
): Promise<AiResponse> {
	if (!config.model) {
		return { content: '', error: 'Model is required for OpenRouter' };
	}

	const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.apiKey}`,
			'HTTP-Referer': 'https://getorbit.app',
			'X-Title': 'Orbit'
		},
		body: JSON.stringify({
			model: config.model,
			max_tokens: 4096,
			messages: [
				{ role: 'system', content: systemPrompt },
				...messages.map((m) => ({ role: m.role, content: m.content }))
			]
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		if (response.status === 401) return { content: '', error: 'Invalid OpenRouter API key' };
		if (response.status === 429) return { content: '', error: 'Rate limit exceeded. Try again later.' };
		return { content: '', error: (error as { error?: { message?: string } }).error?.message || `OpenRouter error: ${response.status}` };
	}

	const data = await response.json();
	const text = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content || '';
	return { content: text };
}

async function sendOllamaMessage(
	config: AiProviderConfig,
	systemPrompt: string,
	messages: AiMessage[]
): Promise<AiResponse> {
	if (!config.model) {
		return { content: '', error: 'Model is required for Ollama' };
	}

	const baseUrl = config.baseUrl || PROVIDER_DEFAULTS.ollama.baseUrl!;

	const response = await fetchWithTimeout(`${baseUrl}/api/chat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: config.model,
			stream: false,
			messages: [
				{ role: 'system', content: systemPrompt },
				...messages.map((m) => ({ role: m.role, content: m.content }))
			]
		})
	});

	if (!response.ok) {
		if (response.status === 404) return { content: '', error: `Model "${config.model}" not found in Ollama` };
		return { content: '', error: `Ollama error: ${response.status}` };
	}

	const data = await response.json();
	const text = (data as { message?: { content?: string } }).message?.content || '';
	return { content: text };
}

/**
 * Send a message to the specified AI provider
 */
export async function sendMessage(
	provider: AiProvider,
	config: AiProviderConfig,
	systemPrompt: string,
	messages: AiMessage[]
): Promise<AiResponse> {
	try {
		switch (provider) {
			case 'anthropic':
				return await sendAnthropicMessage(config, systemPrompt, messages);
			case 'openai':
				return await sendOpenAiMessage(config, systemPrompt, messages);
			case 'gemini':
				return await sendGeminiMessage(config, systemPrompt, messages);
			case 'openrouter':
				return await sendOpenRouterMessage(config, systemPrompt, messages);
			case 'ollama':
				return await sendOllamaMessage(config, systemPrompt, messages);
			default:
				return { content: '', error: `Unknown provider: ${provider}` };
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return { content: '', error: 'Request timed out (60s limit)' };
		}
		return {
			content: '',
			error: error instanceof Error ? error.message : 'Failed to contact AI provider'
		};
	}
}
