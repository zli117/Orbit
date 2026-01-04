<script lang="ts">
	import { marked } from 'marked';

	interface Props {
		queryId?: string | null;
		queryCode?: string | null;
	}

	let { queryId = null, queryCode = null }: Props = $props();

	let result = $state<string | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function executeQuery() {
		if (!queryId && !queryCode) return;

		loading = true;
		error = null;

		try {
			let response;
			if (queryId) {
				// Execute saved query
				response = await fetch(`/api/queries/${queryId}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({})
				});
			} else if (queryCode) {
				// Execute inline code
				response = await fetch('/api/queries/execute', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ code: queryCode })
				});
			}

			if (!response?.ok) {
				throw new Error('Query execution failed');
			}

			const data = await response.json();
			// Widget queries should return a string (Markdown)
			if (typeof data.result === 'string') {
				result = data.result;
			} else {
				// If it's not a string, convert to JSON display
				result = '```json\n' + JSON.stringify(data.result, null, 2) + '\n```';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to execute widget query';
		} finally {
			loading = false;
		}
	}

	// Execute on mount
	$effect(() => {
		executeQuery();
	});

	// Convert Markdown to HTML
	const htmlContent = $derived(result ? marked(result) : '');
</script>

{#if loading}
	<div class="widget-loading">Loading...</div>
{:else if error}
	<div class="widget-error">{error}</div>
{:else if result}
	<div class="widget-content">
		{@html htmlContent}
	</div>
{/if}

<style>
	.widget-loading {
		padding: var(--spacing-sm);
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.widget-error {
		padding: var(--spacing-sm);
		color: var(--color-error);
		font-size: 0.75rem;
		background-color: rgb(239 68 68 / 0.1);
		border-radius: var(--radius-sm);
	}

	.widget-content {
		padding: var(--spacing-sm);
		font-size: 0.875rem;
		background-color: var(--color-bg);
		border-radius: var(--radius-sm);
	}

	.widget-content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: var(--spacing-xs) 0;
	}

	.widget-content :global(th),
	.widget-content :global(td) {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		text-align: left;
	}

	.widget-content :global(th) {
		background-color: var(--color-bg-hover);
		font-weight: 600;
	}

	.widget-content :global(pre) {
		background-color: #1e1e1e;
		color: #d4d4d4;
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
		overflow-x: auto;
		font-size: 0.75rem;
	}

	.widget-content :global(code) {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
	}

	.widget-content :global(ul),
	.widget-content :global(ol) {
		margin: var(--spacing-xs) 0;
		padding-left: var(--spacing-lg);
	}

	.widget-content :global(p) {
		margin: var(--spacing-xs) 0;
	}
</style>
