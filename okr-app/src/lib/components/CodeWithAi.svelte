<script lang="ts">
	import type { Snippet } from 'svelte';
	import MonacoEditor from './MonacoEditor.svelte';
	import AiChat from './AiChat.svelte';

	interface Props {
		value: string;
		editorHeight?: string;
		readonly?: boolean;
		hasAiConfig: boolean;
		configuredProviders: string[];
		activeProvider: string;
		aiCollapsed?: boolean;
		headerSnippet?: Snippet;
		context?: 'query' | 'kr_progress' | 'widget';
	}

	let {
		value = $bindable(''),
		editorHeight = '300px',
		readonly = false,
		hasAiConfig,
		configuredProviders,
		activeProvider,
		aiCollapsed: initialCollapsed = false,
		headerSnippet,
		context = 'query'
	}: Props = $props();

	let collapsed = $state(initialCollapsed);
	let pendingCode = $state('');

	function handleCopyToEditor(code: string) {
		value = code;
	}

	function sendToAi() {
		if (value.trim()) {
			pendingCode = value;
		}
	}
</script>

<div class="code-with-ai">
	<div class="editor-panel">
		<div class="editor-toolbar">
			{#if headerSnippet}
				{@render headerSnippet()}
			{/if}
			<div class="toolbar-right">
				{#if hasAiConfig}
					<button
						class="btn btn-secondary btn-sm"
						onclick={sendToAi}
						disabled={!value.trim()}
						title="Send current code to AI chat"
					>
						Send to AI
					</button>
				{/if}
				<button
					class="btn-icon ai-toggle"
					onclick={() => collapsed = !collapsed}
					title={collapsed ? 'Show AI panel' : 'Hide AI panel'}
				>
					{#if collapsed}
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M15 18l-6-6 6-6"/>
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M9 18l6-6-6-6"/>
						</svg>
					{/if}
				</button>
			</div>
		</div>
		<div class="editor-container">
			<MonacoEditor bind:value height={editorHeight} {readonly} />
		</div>
	</div>

	{#if !collapsed}
		<div class="ai-panel">
			<AiChat
				onCopyToEditor={handleCopyToEditor}
				hasConfig={hasAiConfig}
				{configuredProviders}
				{activeProvider}
				bind:pendingCode
				{context}
			/>
		</div>
	{/if}
</div>

<style>
	.code-with-ai {
		display: flex;
		gap: 0;
		height: 100%;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--color-bg-card);
	}

	.editor-panel {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.editor-toolbar {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		flex-wrap: wrap;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		margin-left: auto;
	}

	.editor-container {
		flex: 1;
		min-height: 0;
	}

	.ai-panel {
		width: 420px;
		flex-shrink: 0;
		border-left: 1px solid var(--color-border);
	}

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.75rem;
	}

	.btn-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.btn-icon:hover {
		background-color: var(--color-bg-hover, #f3f4f6);
		color: var(--color-text);
	}

	@media (max-width: 768px) {
		.code-with-ai {
			flex-direction: column;
		}

		.ai-panel {
			width: 100%;
			border-left: none;
			border-top: 1px solid var(--color-border);
			max-height: 400px;
		}
	}
</style>
