<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { marked } from 'marked';
	import CodeWithAi from '$lib/components/CodeWithAi.svelte';

	interface RenderOutput {
		type: 'markdown' | 'table' | 'plotly' | 'json';
		content: unknown;
	}

	interface TableData {
		headers: string[];
		rows: (string | number)[][];
	}

	interface PlotlyData {
		data: unknown[];
		layout?: Record<string, unknown>;
	}

	let { data } = $props();

	// Plotly containers for charts
	let plotContainers = $state<Record<number, HTMLDivElement>>({});

	// Sample code showing all APIs
	const sampleCode = `// Query Builder - Write JavaScript to analyze your data
//
// Data Fetching:
//   q.daily({ year, month, week, from, to }) - Daily records with metrics
//   q.tasks({ year, tag, completed, periodType }) - Tasks with attributes
//   q.objectives({ year, level }) - Objectives with key results
//   q.today() - Current date: { year, month, day, date, week }
//
// Output (Render API):
//   render.markdown(text) - Render markdown content
//   render.table({ headers, rows }) - Render a table
//   render.json(value) - Render any value as formatted JSON (for debugging)
//   render.plot.bar/line/pie/multi(opts) - Render charts
//
// Progress (for Key Results):
//   progress.set(numerator, denominator) - Set progress as a ratio

// Example: Show this month's metrics
const { year, month } = q.today();
const days = await q.daily({ year, month });

// List available metric keys
const allKeys = new Set();
days.forEach(d => Object.keys(d.metrics).forEach(k => allKeys.add(k)));
render.markdown('## Available metrics: ' + [...allKeys].join(', '));

// Show task completion
render.table({
  headers: ['Date', 'Tasks', 'Hours'],
  rows: days.map(d => [
    d.date,
    d.completedTasks + '/' + d.totalTasks,
    d.totalHours.toFixed(1)
  ])
});

// For Key Results, use progress.set(n, d):
// const tasks = await q.tasks({ tag: 'My_Goal', year });
// const completed = tasks.filter(t => t.completed).length;
// progress.set(completed, tasks.length);`;

	let code = $state(sampleCode);

	function startNewQuery() {
		selectedQuery = null;
		queryName = '';
		queryDescription = '';
		code = sampleCode;
	}

	let result = $state<unknown>(null);
	let renders = $state<RenderOutput[]>([]);
	let progressValue = $state<number | undefined>(undefined);
	let error = $state('');
	let loading = $state(false);

	// Save query form
	let showSaveForm = $state(false);
	let queryName = $state('');
	let queryDescription = $state('');
	let saveLoading = $state(false);

	// Selected query for editing
	let selectedQuery = $state<typeof data.savedQueries[0] | null>(null);

	async function runQuery() {
		loading = true;
		error = '';
		result = null;
		renders = [];
		progressValue = undefined;
		plotContainers = {};

		try {
			const response = await fetch('/api/queries/execute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code })
			});

			const responseData = await response.json();

			if (!response.ok) {
				throw new Error(responseData.error || 'Query failed');
			}

			result = responseData.result;
			renders = responseData.renders || [];
			progressValue = responseData.progressValue;

			// Render Plotly charts after DOM update
			await tick();
			renderPlotlyCharts();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Query execution failed';
		} finally {
			loading = false;
		}
	}

	async function renderPlotlyCharts() {
		if (!renders.some(r => r.type === 'plotly')) return;

		// Dynamically import Plotly only when needed (client-side only)
		const Plotly = await import('plotly.js-basic-dist-min');

		renders.forEach((render, index) => {
			if (render.type === 'plotly' && plotContainers[index]) {
				const plotData = render.content as PlotlyData;
				Plotly.newPlot(
					plotContainers[index],
					plotData.data as Plotly.Data[],
					{
						...plotData.layout,
						autosize: true,
						margin: { t: plotData.layout?.title?.text ? 60 : 20, r: 20, b: 40, l: 50 }
					} as Plotly.Layout,
					{ responsive: true, displayModeBar: false }
				);
			}
		});
	}

	function renderMarkdown(text: string): string {
		return marked.parse(text) as string;
	}

	async function saveQuery() {
		if (!queryName.trim()) return;

		saveLoading = true;

		try {
			const response = await fetch('/api/queries', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: queryName.trim(),
					description: queryDescription.trim() || null,
					code
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to save query');
			}

			queryName = '';
			queryDescription = '';
			showSaveForm = false;
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save query';
		} finally {
			saveLoading = false;
		}
	}

	async function updateQuery() {
		if (!selectedQuery) return;

		saveLoading = true;

		try {
			const response = await fetch(`/api/queries/${selectedQuery.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: queryName.trim(),
					description: queryDescription.trim() || null,
					code
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to update query');
			}

			selectedQuery = null;
			queryName = '';
			queryDescription = '';
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update query';
		} finally {
			saveLoading = false;
		}
	}

	async function deleteQuery(id: string) {
		if (!confirm('Delete this saved query?')) return;

		try {
			const response = await fetch(`/api/queries/${id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete query');
			}

			if (selectedQuery?.id === id) {
				selectedQuery = null;
			}
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete query';
		}
	}

	function loadQuery(query: typeof data.savedQueries[0]) {
		code = query.code;
		selectedQuery = query;
		queryName = query.name;
		queryDescription = query.description || '';
	}

	function formatResult(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}
</script>

<svelte:head>
	<title>Query Builder - RUOK</title>
</svelte:head>

<div class="queries-page">
	<header class="page-header">
		<h1>Query Builder</h1>
		<p class="text-muted">Write custom JavaScript queries to analyze your data</p>
	</header>

	{#if error}
		<div class="error-banner">{error}</div>
	{/if}

	<div class="query-layout">
		<aside class="sidebar">
			<div class="sidebar-section-group">
				<h3 class="sidebar-title">Saved Queries</h3>
				{#if data.savedQueries.length === 0}
					<p class="text-muted sidebar-empty">No saved queries yet</p>
				{:else}
					<ul class="saved-queries-list">
						{#each data.savedQueries as query}
							<li class:active={selectedQuery?.id === query.id}>
								<button class="query-item" onclick={() => loadQuery(query)}>
									<span class="query-name">{query.name}</span>
									{#if query.description}
										<span class="query-desc">{query.description}</span>
									{/if}
								</button>
								<button
									class="btn-icon btn-icon-sm delete-btn"
									onclick={() => deleteQuery(query.id)}
									title="Delete"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="18" y1="6" x2="6" y2="18"/>
										<line x1="6" y1="6" x2="18" y2="18"/>
									</svg>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="sidebar-section-group">
				<h3 class="sidebar-title">API Quick Reference</h3>
				<div class="api-accordion">
					{#each [
						{ title: 'DATA FETCHING', items: [
							'q.daily({ year, month, ... })',
							'q.tasks({ year, tag, periodType, ... })',
							'q.objectives({ year, level })',
							'q.today()'
						]},
						{ title: 'RENDERING', items: [
							'render.markdown(text)',
							'render.table({ headers, rows })',
							'render.json(value)',
							'render.plot.bar/line/pie/multi(...)'
						]},
						{ title: 'HELPERS', items: [
							"q.sum(items, 'field')",
							"q.avg(items, 'field')",
							'q.count(items)',
							"q.parseTime('7:30')",
							'q.formatDuration(450)'
						]},
						{ title: 'DATE/TIME', items: [
							'moment() → current date/time',
							"moment('YYYY-MM-DD') → parse",
							'.format(), .add(), .subtract()',
							'.startOf(), .endOf(), .diff()'
						]},
						{ title: 'PROGRESS', items: [
							'progress.set(n, d)'
						]}
					] as section, sectionIdx}
						<details class="accordion-item" open={sectionIdx === 0}>
							<summary class="accordion-header">
								{section.title}
								<span class="chevron">&#9660;</span>
							</summary>
							<div class="accordion-content">
								{#each section.items as item}
									<code class="code-snippet">{item}</code>
								{/each}
							</div>
						</details>
					{/each}
				</div>
				<a href="/queries/api-reference" target="_blank" rel="noopener" class="api-ref-link">
					Full API Reference
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
						<polyline points="15 3 21 3 21 9"/>
						<line x1="10" y1="14" x2="21" y2="3"/>
					</svg>
				</a>
			</div>
		</aside>

		<div class="editor-section">
			{#if showSaveForm && !selectedQuery}
				<div class="save-form">
					<input
						type="text"
						class="input"
						placeholder="Query name"
						bind:value={queryName}
					/>
					<input
						type="text"
						class="input"
						placeholder="Description (optional)"
						bind:value={queryDescription}
					/>
					<button class="btn btn-primary btn-sm" onclick={saveQuery} disabled={saveLoading || !queryName.trim()}>
						{saveLoading ? 'Saving...' : 'Save'}
					</button>
				</div>
			{/if}

			<div class="editor-card">
				<CodeWithAi
					bind:value={code}
					editorHeight="100%"
					hasAiConfig={data.aiConfig.hasAiConfig}
					configuredProviders={data.aiConfig.configuredProviders}
					activeProvider={data.aiConfig.activeProvider}
					providerModels={data.aiConfig.providerModels}
					context="query"
				>
					{#snippet headerSnippet()}
						{#if selectedQuery}
							<button class="btn btn-secondary btn-sm" onclick={startNewQuery}>
								New Query
							</button>
							<button class="btn btn-primary btn-sm" onclick={updateQuery} disabled={saveLoading}>
								Update "{selectedQuery.name}"
							</button>
						{:else}
							<button class="btn btn-secondary btn-sm" onclick={() => showSaveForm = !showSaveForm}>
								{showSaveForm ? 'Cancel' : 'Save As...'}
							</button>
						{/if}
						<button class="btn btn-primary btn-sm" onclick={runQuery} disabled={loading}>
							{loading ? 'Running...' : 'Run Query'}
						</button>
					{/snippet}
				</CodeWithAi>
			</div>

			<div class="card result-card">
				<h2>Result</h2>
				{#if loading}
					<p class="text-muted">Running query...</p>
				{:else if progressValue !== undefined || renders.length > 0 || result !== null}
					{#if progressValue !== undefined}
						<div class="progress-result">
							<h3>Progress Value</h3>
							<div class="progress-display">
								<div class="progress-bar">
									<div class="progress-fill" style="width: {progressValue * 100}%"></div>
								</div>
								<span class="progress-value">{(progressValue * 100).toFixed(1)}%</span>
							</div>
						</div>
					{/if}
					{#if renders.length > 0}
						<div class="renders">
							{#each renders as render, index}
								{#if render.type === 'markdown'}
									<div class="render-markdown">
										{@html renderMarkdown(render.content as string)}
									</div>
								{:else if render.type === 'table'}
									{@const tableData = render.content as TableData}
									<div class="render-table">
										<table>
											<thead>
												<tr>
													{#each tableData.headers as header}
														<th>{header}</th>
													{/each}
												</tr>
											</thead>
											<tbody>
												{#each tableData.rows as row}
													<tr>
														{#each row as cell}
															<td>{cell}</td>
														{/each}
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{:else if render.type === 'json'}
									<div class="render-json">
										<pre><code>{JSON.stringify(render.content, null, 2)}</code></pre>
									</div>
								{:else if render.type === 'plotly'}
									<div class="render-plotly" bind:this={plotContainers[index]}></div>
								{/if}
							{/each}
						</div>
					{/if}
					{#if result !== null && result !== undefined}
						<div class="return-value">
							<h3>Return Value</h3>
							<pre class="result-output">{formatResult(result)}</pre>
						</div>
					{/if}
				{:else}
					<p class="text-muted">Run a query to see results</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.queries-page {
		max-width: 1800px;
		margin: 0 auto;
		padding: var(--spacing-lg);
	}

	.page-header {
		margin-bottom: var(--spacing-lg);
	}

	.page-header h1 {
		margin: 0 0 var(--spacing-xs);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.error-banner {
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		color: var(--color-error);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
	}

	/* Layout: sidebar + editor (no fixed height) */
	.query-layout {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: var(--spacing-lg);
		align-items: start;
	}

	@media (max-width: 1024px) {
		.query-layout {
			grid-template-columns: 1fr;
		}

		.sidebar {
			display: none;
		}
	}

	/* Unified sidebar */
	.sidebar {
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--spacing-lg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xl);
		height: fit-content;
		align-self: flex-start;
	}

	.sidebar-title {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		margin: 0 0 var(--spacing-sm);
	}

	.sidebar-empty {
		font-size: 0.875rem;
		margin: 0;
	}

	.saved-queries-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.saved-queries-list li {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		transition: all 0.15s ease;
	}

	.saved-queries-list li:hover {
		border-color: rgb(191 219 254);
		background: rgb(239 246 255);
	}

	.saved-queries-list li.active {
		border-color: rgb(147 197 253);
		background: rgb(239 246 255);
	}

	.delete-btn {
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.saved-queries-list li:hover .delete-btn {
		opacity: 1;
	}

	.query-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--spacing-xs) 0;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
	}

	.query-item:hover {
		color: var(--color-primary);
	}

	.query-name {
		font-weight: 500;
		font-size: 0.875rem;
	}

	.query-desc {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.btn-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-icon:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-error);
	}

	.btn-icon-sm {
		width: 24px;
		height: 24px;
	}

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.75rem;
	}

	/* Accordion */
	.api-accordion {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.accordion-item {
		border-radius: var(--radius-md);
	}

	.accordion-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-xs);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: background 0.15s ease;
		list-style: none;
	}

	.accordion-header::-webkit-details-marker {
		display: none;
	}

	.accordion-header:hover {
		background: var(--color-bg-hover);
	}

	.chevron {
		font-size: 0.6rem;
		color: var(--color-text-muted);
		transition: transform 0.2s ease;
	}

	.accordion-item[open] .chevron {
		transform: rotate(180deg);
	}

	.accordion-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-sm);
	}

	.code-snippet {
		display: block;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
		color: var(--color-text);
		white-space: pre-wrap;
	}

	.api-ref-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: var(--spacing-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-primary);
		color: white;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 500;
		text-decoration: none;
		transition: background 0.15s ease;
	}

	.api-ref-link:hover {
		background: var(--color-primary-hover, #2563eb);
	}

	/* Editor section */
	.editor-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.editor-card {
		height: 60vh;
	}

	.save-form {
		display: flex;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background-color: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.save-form .input {
		flex: 1;
	}

	/* Result card - no shadow, grows with content */
	.result-card {
		box-shadow: none;
	}

	.result-card h2 {
		margin: 0 0 var(--spacing-md);
		font-size: 1rem;
	}

	.result-output {
		padding: var(--spacing-md);
		background-color: var(--color-bg);
		border-radius: var(--radius-md);
		font-family: monospace;
		font-size: 0.875rem;
		overflow-x: auto;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Progress result styles */
	.progress-result {
		margin-bottom: var(--spacing-md);
		padding-bottom: var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
	}

	.progress-result h3 {
		margin: 0 0 var(--spacing-sm);
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.progress-display {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.progress-bar {
		flex: 1;
		height: 24px;
		background-color: var(--color-bg);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--color-primary);
		border-radius: var(--radius-md);
		transition: width 0.3s ease;
	}

	.progress-value {
		font-size: 1.25rem;
		font-weight: 600;
		min-width: 70px;
		text-align: right;
	}

	/* Render output styles */
	.renders {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.render-markdown {
		font-size: 0.875rem;
		line-height: 1.6;
	}

	.render-markdown :global(h1),
	.render-markdown :global(h2),
	.render-markdown :global(h3) {
		margin: 0 0 var(--spacing-sm);
	}

	.render-markdown :global(h1) { font-size: 1.5rem; }
	.render-markdown :global(h2) { font-size: 1.25rem; }
	.render-markdown :global(h3) { font-size: 1rem; }

	.render-markdown :global(p) {
		margin: 0 0 var(--spacing-sm);
	}

	.render-markdown :global(p:last-child) {
		margin-bottom: 0;
	}

	.render-markdown :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.render-markdown :global(th),
	.render-markdown :global(td) {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		text-align: left;
	}

	.render-markdown :global(th) {
		background: var(--color-bg);
		font-weight: 600;
	}

	.render-table {
		overflow-x: auto;
	}

	.render-table table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.render-table th,
	.render-table td {
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		text-align: left;
	}

	.render-table th {
		background: var(--color-bg);
		font-weight: 600;
	}

	.render-json {
		overflow-x: auto;
	}

	.render-json pre {
		margin: 0;
		padding: var(--spacing-sm);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.render-plotly {
		min-height: 250px;
	}

	.return-value {
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}

	.return-value h3 {
		margin: 0 0 var(--spacing-sm);
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}
</style>
