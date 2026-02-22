<script lang="ts">
	import { marked } from 'marked';
	import { tick } from 'svelte';

	interface AiMessage {
		role: 'user' | 'assistant';
		content: string;
	}

	interface ParsedBlock {
		type: 'text' | 'code';
		content: string;
	}

	let {
		onCopyToEditor,
		hasConfig,
		configuredProviders = [],
		activeProvider = 'anthropic',
		pendingCode = $bindable(''),
		context = 'query'
	}: {
		onCopyToEditor: (code: string) => void;
		hasConfig: boolean;
		configuredProviders: string[];
		activeProvider: string;
		pendingCode?: string;
		context?: 'query' | 'kr_progress' | 'widget';
	} = $props();

	let messages = $state<AiMessage[]>([]);
	let inputText = $state('');
	let loading = $state(false);
	let error = $state('');
	let selectedProvider = $state(activeProvider);
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let inputTextarea = $state<HTMLTextAreaElement | null>(null);

	// When editor sends code to AI, populate the input
	$effect(() => {
		if (pendingCode) {
			inputText = "```\n" + pendingCode + "\n```\n";
			pendingCode = '';
			tick().then(() => {
				if (inputTextarea) {
					inputTextarea.focus();
					inputTextarea.setSelectionRange(0, 0);
				}
			});
		}
	});

	const providerLabels: Record<string, string> = {
		anthropic: 'Anthropic',
		openai: 'OpenAI',
		gemini: 'Gemini',
		openrouter: 'OpenRouter',
		ollama: 'Ollama'
	};

	const suggestions = [
		'Show my sleep trends this month',
		'Task completion rate by tag',
		'Weekly productivity report'
	];

	function parseResponse(content: string): ParsedBlock[] {
		const blocks: ParsedBlock[] = [];
		const regex = /<code>([\s\S]*?)<\/code>/g;
		let lastIndex = 0;
		let match;

		while ((match = regex.exec(content)) !== null) {
			if (match.index > lastIndex) {
				blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
			}
			blocks.push({ type: 'code', content: match[1].trim() });
			lastIndex = match.index + match[0].length;
		}

		if (lastIndex < content.length) {
			blocks.push({ type: 'text', content: content.slice(lastIndex) });
		}

		// If no <code> tags found, treat entire content as text
		if (blocks.length === 0) {
			blocks.push({ type: 'text', content });
		}

		return blocks;
	}

	function renderMarkdown(text: string): string {
		return marked.parse(text) as string;
	}

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Fallback: create a temporary textarea
			const ta = document.createElement('textarea');
			ta.value = text;
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
	}

	async function sendMessage(text?: string) {
		const messageText = text || inputText.trim();
		if (!messageText || loading) return;

		inputText = '';
		error = '';

		// Add user message
		messages = [...messages, { role: 'user', content: messageText }];
		await scrollToBottom();

		loading = true;

		try {
			const response = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages,
					provider: selectedProvider !== activeProvider ? selectedProvider : undefined,
					context
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to get response');
			}

			messages = [...messages, { role: 'assistant', content: result.content }];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to get AI response';
		} finally {
			loading = false;
			await scrollToBottom();
		}
	}

	async function switchProvider(newProvider: string) {
		selectedProvider = newProvider;
		// Update the active provider on the server
		try {
			await fetch('/api/ai/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ provider: newProvider })
			});
		} catch {
			// Non-critical — continue using it locally
		}
	}

	function clearChat() {
		messages = [];
		error = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<div class="ai-chat">
	<div class="chat-header">
		<h3>AI Assistant</h3>
		<div class="header-actions">
			{#if configuredProviders.length > 1}
				<select
					class="provider-select"
					value={selectedProvider}
					onchange={(e) => switchProvider(e.currentTarget.value)}
				>
					{#each configuredProviders as provider}
						<option value={provider}>{providerLabels[provider] || provider}</option>
					{/each}
				</select>
			{:else if configuredProviders.length === 1}
				<span class="provider-label">{providerLabels[configuredProviders[0]] || configuredProviders[0]}</span>
			{/if}
			{#if messages.length > 0}
				<button class="btn-icon" onclick={clearChat} title="New chat">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<div class="chat-messages" bind:this={messagesContainer}>
		{#if !hasConfig}
			<div class="setup-prompt">
				<p>Configure your AI provider to get started.</p>
				<a href="/settings/ai" class="btn btn-primary btn-sm">Set up AI Provider</a>
			</div>
		{:else if messages.length === 0}
			<div class="welcome">
				<p class="welcome-text">Ask me to write queries for your data.</p>
				<div class="suggestions">
					{#each suggestions as suggestion}
						<button class="suggestion-btn" onclick={() => sendMessage(suggestion)}>
							{suggestion}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			{#each messages as message}
				<div class="message message-{message.role}">
					<div class="message-role">{message.role === 'user' ? 'You' : 'AI'}</div>
					{#if message.role === 'user'}
						<div class="message-content">{message.content}</div>
					{:else}
						{#each parseResponse(message.content) as block}
							{#if block.type === 'text'}
								<div class="message-text">
									{@html renderMarkdown(block.content)}
								</div>
							{:else}
								<div class="code-block">
									<pre><code>{block.content}</code></pre>
									<div class="code-actions">
										<button
											class="btn btn-primary btn-xs"
											onclick={() => onCopyToEditor(block.content)}
										>
											Copy to Editor
										</button>
										<button
											class="btn btn-secondary btn-xs"
											onclick={() => copyToClipboard(block.content)}
										>
											Copy
										</button>
									</div>
								</div>
							{/if}
						{/each}
					{/if}
				</div>
			{/each}
		{/if}

		{#if loading}
			<div class="message message-assistant">
				<div class="message-role">AI</div>
				<div class="typing-indicator">
					<span></span><span></span><span></span>
				</div>
			</div>
		{/if}
	</div>

	{#if error}
		<div class="chat-error">{error}</div>
	{/if}

	<div class="chat-input">
		<textarea
			bind:this={inputTextarea}
			bind:value={inputText}
			placeholder={hasConfig ? 'Ask about your data...' : 'Configure AI provider first'}
			onkeydown={handleKeydown}
			disabled={loading || !hasConfig}
			rows="2"
		></textarea>
		<button
			class="btn btn-primary send-btn"
			onclick={() => sendMessage()}
			disabled={loading || !inputText.trim() || !hasConfig}
		>
			{#if loading}
				...
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
				</svg>
			{/if}
		</button>
	</div>
</div>

<style>
	.ai-chat {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-surface, white);
		overflow: hidden;
	}

	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
		min-height: 65px;
	}

	.chat-header h3 {
		margin: 0;
		font-size: 0.875rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.provider-select {
		font-size: 0.75rem;
		padding: 2px 6px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		cursor: pointer;
	}

	.provider-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.btn-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.btn-icon:hover {
		background-color: var(--color-bg-hover, #f3f4f6);
		color: var(--color-text);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.setup-prompt {
		text-align: center;
		padding: var(--spacing-xl) var(--spacing-md);
		color: var(--color-text-muted);
	}

	.setup-prompt p {
		margin: 0 0 var(--spacing-md);
		font-size: 0.875rem;
	}

	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--spacing-md);
		gap: var(--spacing-sm);
	}

	.welcome-text {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0;
	}

	.suggestions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		width: 100%;
	}

	.suggestion-btn {
		display: block;
		width: 100%;
		text-align: left;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		font-size: 0.8125rem;
		color: var(--color-text);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.suggestion-btn:hover {
		border-color: var(--color-primary);
		background: rgb(59 130 246 / 0.05);
	}

	/* Messages */
	.message {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.message-role {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.message-user .message-content {
		background: var(--color-bg);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		line-height: 1.5;
	}

	.message-text {
		font-size: 0.8125rem;
		line-height: 1.6;
	}

	.message-text :global(p) {
		margin: 0 0 var(--spacing-xs);
	}

	.message-text :global(p:last-child) {
		margin-bottom: 0;
	}

	.message-text :global(code) {
		background: var(--color-bg);
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 0.75rem;
	}

	.message-text :global(pre) {
		background: var(--color-bg);
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		overflow-x: auto;
		font-size: 0.75rem;
		margin: var(--spacing-xs) 0;
	}

	.message-text :global(pre code) {
		background: none;
		padding: 0;
	}

	/* Code blocks from <code> tags */
	.code-block {
		margin: var(--spacing-xs) 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.code-block pre {
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-bg);
		overflow-x: auto;
		font-size: 0.75rem;
		line-height: 1.5;
		max-height: 300px;
		overflow-y: auto;
	}

	.code-block pre code {
		font-family: monospace;
	}

	.code-actions {
		display: flex;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		border-top: 1px solid var(--color-border);
		background: var(--color-surface, white);
	}

	.btn-xs {
		padding: 2px 8px;
		font-size: 0.6875rem;
	}

	/* Typing animation */
	.typing-indicator {
		display: flex;
		gap: 4px;
		padding: var(--spacing-sm) 0;
	}

	.typing-indicator span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--color-text-muted);
		animation: typing 1.4s infinite ease-in-out;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-indicator span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes typing {
		0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
		30% { opacity: 1; transform: translateY(-4px); }
	}

	/* Error */
	.chat-error {
		padding: var(--spacing-xs) var(--spacing-md);
		background: #fef2f2;
		border-top: 1px solid #fecaca;
		color: var(--color-error);
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	/* Input */
	.chat-input {
		display: flex;
		align-items: stretch;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm);
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.chat-input textarea {
		flex: 1;
		resize: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-sm);
		font-size: 0.8125rem;
		font-family: inherit;
		line-height: 1.4;
		min-height: 0;
	}

	.chat-input textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.send-btn {
		flex-shrink: 0;
		width: 40px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
	}
</style>
