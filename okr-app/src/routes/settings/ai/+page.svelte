<script lang="ts">
	let { data } = $props();

	type Provider = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'ollama';

	const providers: { id: Provider; label: string; needsApiKey: boolean; needsBaseUrl: boolean; modelRequired: boolean }[] = [
		{ id: 'anthropic', label: 'Anthropic', needsApiKey: true, needsBaseUrl: false, modelRequired: false },
		{ id: 'openai', label: 'OpenAI', needsApiKey: true, needsBaseUrl: false, modelRequired: false },
		{ id: 'gemini', label: 'Gemini', needsApiKey: true, needsBaseUrl: false, modelRequired: false },
		{ id: 'openrouter', label: 'OpenRouter', needsApiKey: true, needsBaseUrl: false, modelRequired: true },
		{ id: 'ollama', label: 'Ollama', needsApiKey: false, needsBaseUrl: true, modelRequired: true }
	];

	let activeProvider = $state<Provider>(data.aiConfig?.provider || 'anthropic');
	let apiKey = $state('');
	let model = $state('');
	let baseUrl = $state('');
	let customSystemPrompt = $state(data.aiConfig?.customSystemPrompt || '');
	let showPromptEditor = $state(false);
	let showApiKey = $state(false);

	let saving = $state(false);
	let testing = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// Load saved config for the active provider
	function getProviderConfig(provider: Provider) {
		const config = data.aiConfig?.providersConfig?.[provider];
		return {
			apiKeyMasked: config?.apiKeyMasked || '',
			model: config?.model || '',
			baseUrl: config?.baseUrl || ''
		};
	}

	// Update form fields when provider changes
	$effect(() => {
		const config = getProviderConfig(activeProvider);
		apiKey = '';
		model = config.model;
		baseUrl = config.baseUrl || (data.providerDefaults as Record<string, { baseUrl?: string }>)[activeProvider]?.baseUrl || '';
		showApiKey = false;
	});

	function getDefaultModel(provider: Provider): string {
		return (data.providerDefaults as Record<string, { model?: string }>)[provider]?.model || '';
	}

	function getModelPlaceholder(provider: Provider): string {
		const defaultModel = getDefaultModel(provider);
		if (defaultModel) return `Default: ${defaultModel}`;
		return 'Required — e.g., ' + (provider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' : 'llama3.2');
	}

	function isConfigured(provider: Provider): boolean {
		const config = data.aiConfig?.providersConfig?.[provider];
		if (!config) return false;
		const providerInfo = providers.find(p => p.id === provider);
		if (providerInfo?.needsApiKey && !config.apiKeyMasked) return false;
		return true;
	}

	async function saveConfig() {
		saving = true;
		message = null;

		try {
			const providerConfig: Record<string, string> = {};
			if (apiKey) providerConfig.apiKey = apiKey;
			if (model) providerConfig.model = model;
			const providerInfo = providers.find(p => p.id === activeProvider);
			if (providerInfo?.needsBaseUrl && baseUrl) providerConfig.baseUrl = baseUrl;

			const response = await fetch('/api/ai/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: activeProvider,
					providerConfig,
					customSystemPrompt: showPromptEditor ? (customSystemPrompt || null) : undefined
				})
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to save');
			}

			message = { type: 'success', text: 'Configuration saved' };

			// Refresh data
			const configResponse = await fetch('/api/ai/config');
			if (configResponse.ok) {
				const configData = await configResponse.json();
				if (configData.config) {
					data.aiConfig = configData.config;
				}
			}

			apiKey = '';
			showApiKey = false;
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to save' };
		} finally {
			saving = false;
		}
	}

	async function testConnection() {
		testing = true;
		message = null;

		try {
			// Save first if there's a new API key
			if (apiKey) {
				await saveConfig();
			}

			const response = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [{ role: 'user', content: 'Say "Connection successful!" and nothing else.' }]
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Connection test failed');
			}

			message = { type: 'success', text: `Connection successful! Response: "${result.content.slice(0, 100)}"` };
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Connection test failed' };
		} finally {
			testing = false;
		}
	}

	function resetPrompt() {
		customSystemPrompt = '';
	}
</script>

<svelte:head>
	<title>AI Assistant Settings - Orbit</title>
</svelte:head>

<div class="settings-page">
	<a href="/settings" class="back-link">← Settings</a>

	<header class="page-header">
		<h1>AI Assistant</h1>
		<p class="text-muted">Configure your LLM provider for AI-powered code generation in the Query Builder</p>
	</header>

	{#if message}
		<div class="message" class:success={message.type === 'success'} class:error={message.type === 'error'}>
			{message.text}
		</div>
	{/if}

	<div class="settings-grid">
		<!-- Provider Selection -->
		<div class="card">
			<h2>LLM Provider</h2>
			<p class="text-muted">Select your AI provider and enter your API credentials</p>

			<div class="provider-section">
				<div class="preference-row">
					<div class="preference-info">
						<span class="preference-label">Provider</span>
					</div>
					<select class="input preference-select" bind:value={activeProvider}>
						{#each providers as provider}
							<option value={provider.id}>
								{provider.label}
								{#if isConfigured(provider.id)}(configured){/if}
							</option>
						{/each}
					</select>
				</div>

				{#each providers as provider}
					{#if provider.id === activeProvider}
						<!-- API Key -->
						{#if provider.needsApiKey}
							<div class="field-group">
								<label class="field-label" for="api-key">
									API Key
									{#if getProviderConfig(provider.id).apiKeyMasked}
										<span class="configured-badge">Configured ({getProviderConfig(provider.id).apiKeyMasked})</span>
									{/if}
								</label>
								<div class="input-with-toggle">
									{#if showApiKey}
										<input
											type="text"
											id="api-key"
											class="input"
											bind:value={apiKey}
											placeholder="Enter new API key"
										/>
									{:else}
										<input
											type="password"
											id="api-key"
											class="input"
											bind:value={apiKey}
											placeholder="Enter new API key"
										/>
									{/if}
									<button
										class="btn btn-secondary btn-sm toggle-btn"
										onclick={() => showApiKey = !showApiKey}
										type="button"
									>
										{showApiKey ? 'Hide' : 'Show'}
									</button>
								</div>
								{#if !getProviderConfig(provider.id).apiKeyMasked}
									<span class="field-hint">Leave empty API key fields unchanged when saving</span>
								{/if}
							</div>
						{/if}

						<!-- Model -->
						<div class="field-group">
							<label class="field-label" for="model">
								Model
								{#if provider.modelRequired}
									<span class="required-badge">Required</span>
								{/if}
							</label>
							<input
								type="text"
								id="model"
								class="input"
								bind:value={model}
								placeholder={getModelPlaceholder(provider.id)}
							/>
						</div>

						<!-- Base URL (Ollama) -->
						{#if provider.needsBaseUrl}
							<div class="field-group">
								<label class="field-label" for="base-url">Base URL</label>
								<input
									type="text"
									id="base-url"
									class="input"
									bind:value={baseUrl}
									placeholder="http://localhost:11434"
								/>
							</div>
						{/if}
					{/if}
				{/each}

				<div class="action-row">
					<button class="btn btn-primary" onclick={saveConfig} disabled={saving}>
						{saving ? 'Saving...' : 'Save'}
					</button>
					<button class="btn btn-secondary" onclick={testConnection} disabled={testing || saving}>
						{testing ? 'Testing...' : 'Test Connection'}
					</button>
				</div>
			</div>
		</div>

		<!-- System Prompt -->
		<div class="card">
			<div class="prompt-header">
				<h2>System Prompt</h2>
				<button
					class="btn btn-secondary btn-sm"
					onclick={() => showPromptEditor = !showPromptEditor}
				>
					{showPromptEditor ? 'Hide' : 'Customize'}
				</button>
			</div>
			<p class="text-muted">
				The system prompt tells the AI how to generate code. The API reference and your metrics are automatically appended.
			</p>

			{#if showPromptEditor}
				<div class="prompt-editor">
					<textarea
						class="input prompt-textarea"
						bind:value={customSystemPrompt}
						placeholder="Leave empty to use the built-in default prompt. The API reference and your metrics info are appended automatically."
						rows="12"
					></textarea>
					<div class="prompt-actions">
						<button class="btn btn-secondary btn-sm" onclick={resetPrompt}>
							Reset to Default
						</button>
						<span class="field-hint">
							Use &#123;&#123;API_REFERENCE&#125;&#125; and &#123;&#123;USER_METRICS&#125;&#125; as placeholders
						</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.settings-page {
		max-width: 800px;
		margin: 0 auto;
		padding: var(--spacing-lg);
	}

	.back-link {
		display: inline-block;
		margin-bottom: var(--spacing-md);
		color: var(--color-primary);
		text-decoration: none;
		font-size: 0.875rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.page-header {
		margin-bottom: var(--spacing-lg);
	}

	.page-header h1 {
		margin: 0 0 var(--spacing-xs);
	}

	.message {
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
		font-size: 0.875rem;
	}

	.message.success {
		background-color: #f0fdf4;
		border: 1px solid #bbf7d0;
		color: var(--color-success);
	}

	.message.error {
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		color: var(--color-error);
	}

	.settings-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.card h2 {
		margin: 0 0 var(--spacing-xs);
		font-size: 1.125rem;
	}

	.provider-section {
		margin-top: var(--spacing-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.preference-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
	}

	.preference-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.preference-label {
		font-weight: 500;
	}

	.preference-select {
		width: auto;
		min-width: 200px;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.field-label {
		font-weight: 500;
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.field-hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.configured-badge {
		font-weight: 400;
		font-size: 0.75rem;
		color: var(--color-success);
	}

	.required-badge {
		font-weight: 400;
		font-size: 0.7rem;
		color: var(--color-error);
		background-color: #fef2f2;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
	}

	.input-with-toggle {
		display: flex;
		gap: var(--spacing-xs);
	}

	.input-with-toggle .input {
		flex: 1;
	}

	.toggle-btn {
		flex-shrink: 0;
	}

	.action-row {
		display: flex;
		gap: var(--spacing-sm);
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--color-border);
	}

	.prompt-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.prompt-editor {
		margin-top: var(--spacing-md);
	}

	.prompt-textarea {
		width: 100%;
		font-family: monospace;
		font-size: 0.8125rem;
		line-height: 1.5;
		resize: vertical;
	}

	.prompt-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		margin-top: var(--spacing-sm);
	}
</style>
