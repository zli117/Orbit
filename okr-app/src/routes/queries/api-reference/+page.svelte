<script lang="ts">
	import { marked } from 'marked';

	let { data } = $props();

	const renderedHtml = marked.parse(data.markdownContent) as string;
</script>

<svelte:head>
	<title>API Reference - Query Builder - Orbit</title>
</svelte:head>

<div class="api-reference">
	{@html renderedHtml}
</div>

<style>
	.api-reference {
		max-width: 900px;
		margin: 0 auto;
		padding: var(--spacing-lg);
		font-size: 0.9375rem;
		line-height: 1.7;
	}

	/* Headings */
	.api-reference :global(h1) {
		font-size: 1.75rem;
		margin: 0 0 var(--spacing-xs);
		padding-bottom: var(--spacing-lg);
		border-bottom: 2px solid var(--color-border);
	}

	.api-reference :global(h2) {
		font-size: 1.375rem;
		margin: var(--spacing-xl) 0 var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}

	.api-reference :global(h2:first-of-type) {
		border-top: none;
	}

	.api-reference :global(h3) {
		font-size: 1.1rem;
		margin: var(--spacing-lg) 0 var(--spacing-sm);
	}

	.api-reference :global(h4) {
		font-size: 0.9375rem;
		margin: var(--spacing-md) 0 var(--spacing-xs);
		color: var(--color-text-muted);
	}

	/* Code */
	.api-reference :global(pre) {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		overflow-x: auto;
		font-size: 0.8125rem;
		line-height: 1.5;
		margin: var(--spacing-sm) 0 var(--spacing-md);
	}

	.api-reference :global(pre code) {
		background: none;
		padding: 0;
		font-size: inherit;
	}

	.api-reference :global(code) {
		background: var(--color-bg);
		padding: 1px 5px;
		border-radius: 3px;
		font-size: 0.8125rem;
	}

	/* Tables */
	.api-reference :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: var(--spacing-sm) 0 var(--spacing-md);
		font-size: 0.875rem;
	}

	.api-reference :global(th),
	.api-reference :global(td) {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		text-align: left;
	}

	.api-reference :global(th) {
		background: var(--color-bg);
		font-weight: 600;
	}

	.api-reference :global(th code),
	.api-reference :global(td code) {
		font-size: 0.75rem;
	}

	/* Lists */
	.api-reference :global(ul),
	.api-reference :global(ol) {
		padding-left: var(--spacing-lg);
	}

	.api-reference :global(li) {
		margin-bottom: 4px;
	}

	.api-reference :global(p) {
		margin: 0 0 var(--spacing-sm);
	}

	/* Horizontal rules */
	.api-reference :global(hr) {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: var(--spacing-xl) 0;
	}

	/* Blockquotes */
	.api-reference :global(blockquote) {
		border-left: 3px solid var(--color-primary);
		margin: var(--spacing-sm) 0 var(--spacing-md);
		padding: var(--spacing-xs) var(--spacing-md);
		color: var(--color-text-muted);
	}

	@media (max-width: 768px) {
		.api-reference {
			padding: var(--spacing-md);
		}

		.api-reference :global(pre) {
			font-size: 0.75rem;
			padding: var(--spacing-sm);
		}
	}
</style>
