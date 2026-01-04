<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Query type filter and selection
	type QueryTypeFilter = 'all' | 'progress' | 'widget' | 'general';
	type QueryType = 'progress' | 'widget' | 'general';
	let selectedTypeFilter = $state<QueryTypeFilter>('all');
	let queryType = $state<QueryType>('general');

	// Filtered queries based on selected type
	const filteredQueries = $derived(
		selectedTypeFilter === 'all'
			? data.savedQueries
			: data.savedQueries.filter(q => q.queryType === selectedTypeFilter)
	);

	// Sample code templates for each query type
	const sampleCode: Record<QueryType, string> = {
		general: `// General Query - Return any data structure
// Available methods:
//   q.daily({ year, month, week, from, to })
//   q.tasks({ year, tag, completed })
//   q.objectives({ year, level })
//
// Helper functions:
//   q.sum(items, field), q.avg(items, field), q.count(items)
//   q.parseTime("7:30") -> 450 (minutes)
//   q.formatDuration(450) -> "7h 30m"
//   q.formatPercent(3, 10) -> "30%"

// Example: Get this month's sleep data
const days = await q.daily({ year: 2025, month: 1 });

const sleepData = days.map(d => ({
  date: d.date,
  sleep: d.sleepLength,
  sleepMinutes: q.parseTime(d.sleepLength || "0:00")
}));

const avgSleep = q.avg(sleepData, 'sleepMinutes');

return {
  days: sleepData.length,
  avgSleep: q.formatDuration(avgSleep),
  goodSleepDays: sleepData.filter(d => d.sleepMinutes >= 420).length
};`,
		progress: `// Progress Query - Return a number between 0 and 1
// Used for Key Result progress tracking
//
// Examples:
// - Task completion rate: completed / total
// - Habit streak: daysCompleted / targetDays
// - Reading goal: booksRead / targetBooks

// Example: Calculate progress for tasks with a specific tag
const tasks = await q.tasks({ tag: 'Read_Books', year: 2025 });

if (tasks.length === 0) return 0;

const completed = tasks.filter(t => t.completed).length;
return completed / tasks.length; // Returns 0.0 to 1.0`,
		widget: `// Widget Query - Return Markdown for custom display
// Rendered as HTML in Key Result widgets
//
// Supported Markdown:
// - Tables: | Header | Header |
// - Lists: - item or 1. item
// - Bold/Italic: **bold** *italic*
// - Code: \`inline\` or \`\`\`block\`\`\`

// Example: Create a table showing daily step counts
const days = await q.daily({ year: 2025, month: 1 });

const rows = days
  .filter(d => d.steps)
  .slice(-7) // Last 7 days
  .map(d => \`| \${d.date} | \${d.steps?.toLocaleString() || '-'} |\`)
  .join('\\n');

return \`### Recent Steps
| Date | Steps |
|------|-------|
\${rows}\`;`
	};

	let code = $state(sampleCode.general);

	// Track if the user has modified the code (to avoid overwriting their work)
	let codeModified = $state(false);

	function setQueryTypeWithSample(type: QueryType) {
		// Only update sample code if creating new query and code hasn't been modified
		if (!selectedQuery && !codeModified) {
			code = sampleCode[type];
		}
		queryType = type;
	}

	function startNewQuery(type: QueryType) {
		selectedQuery = null;
		queryName = '';
		queryDescription = '';
		queryType = type;
		code = sampleCode[type];
		codeModified = false;
	}

	let result = $state<unknown>(null);
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

		try {
			const response = await fetch('/api/queries/execute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Query failed');
			}

			result = data.result;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Query execution failed';
		} finally {
			loading = false;
		}
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
					queryType,
					code
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to save query');
			}

			queryName = '';
			queryDescription = '';
			queryType = 'general';
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
					queryType,
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
			queryType = 'general';
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
		queryType = (query.queryType as QueryType) || 'general';
	}

	function formatResult(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}
</script>

<svelte:head>
	<title>Query Playground - OKR Tracker</title>
</svelte:head>

<div class="queries-page">
	<header class="page-header">
		<h1>Query Playground</h1>
		<p class="text-muted">Write custom JavaScript queries to analyze your OKR data</p>
	</header>

	{#if error}
		<div class="error-banner">{error}</div>
	{/if}

	<div class="query-layout">
		<div class="editor-section">
			<div class="card editor-card">
				<div class="editor-header">
					<h2>Code Editor</h2>
					<div class="editor-actions">
						{#if selectedQuery}
							<button class="btn btn-secondary btn-sm" onclick={() => startNewQuery('general')}>
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
						<button class="btn btn-primary" onclick={runQuery} disabled={loading}>
							{loading ? 'Running...' : 'Run Query'}
						</button>
					</div>
				</div>

				{#if !selectedQuery}
					<div class="new-query-type-tabs">
						<span class="type-label">New:</span>
						<button
							class="type-tab"
							class:active={queryType === 'general'}
							onclick={() => startNewQuery('general')}
						>General</button>
						<button
							class="type-tab"
							class:active={queryType === 'progress'}
							onclick={() => startNewQuery('progress')}
						>Progress (0-1)</button>
						<button
							class="type-tab"
							class:active={queryType === 'widget'}
							onclick={() => startNewQuery('widget')}
						>Widget (Markdown)</button>
					</div>
				{/if}

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

				{#if selectedQuery}
					<div class="edit-type-row">
						<label>Type:</label>
						<select class="input type-select" bind:value={queryType}>
							<option value="general">General</option>
							<option value="progress">Progress (0-1)</option>
							<option value="widget">Widget (Markdown)</option>
						</select>
					</div>
				{/if}

				<textarea
					class="code-editor"
					bind:value={code}
					oninput={() => codeModified = true}
					spellcheck="false"
					placeholder="Write your query here..."
				></textarea>
			</div>

			<div class="card result-card">
				<h2>Result</h2>
				{#if loading}
					<p class="text-muted">Running query...</p>
				{:else if result !== null}
					<pre class="result-output">{formatResult(result)}</pre>
				{:else}
					<p class="text-muted">Run a query to see results</p>
				{/if}
			</div>
		</div>

		<div class="saved-section">
			<div class="card">
				<h2>Saved Queries</h2>

				<div class="type-tabs">
					<button
						class="type-tab"
						class:active={selectedTypeFilter === 'all'}
						onclick={() => selectedTypeFilter = 'all'}
					>All</button>
					<button
						class="type-tab"
						class:active={selectedTypeFilter === 'progress'}
						onclick={() => selectedTypeFilter = 'progress'}
					>Progress</button>
					<button
						class="type-tab"
						class:active={selectedTypeFilter === 'widget'}
						onclick={() => selectedTypeFilter = 'widget'}
					>Widget</button>
					<button
						class="type-tab"
						class:active={selectedTypeFilter === 'general'}
						onclick={() => selectedTypeFilter = 'general'}
					>General</button>
				</div>

				{#if filteredQueries.length === 0}
					<p class="text-muted">No {selectedTypeFilter === 'all' ? '' : selectedTypeFilter + ' '}queries yet</p>
				{:else}
					<ul class="saved-queries-list">
						{#each filteredQueries as query}
							<li class:active={selectedQuery?.id === query.id}>
								<button class="query-item" onclick={() => loadQuery(query)}>
									<div class="query-header">
										<span class="query-name">{query.name}</span>
										<span class="query-type-badge" class:type-progress={query.queryType === 'progress'} class:type-widget={query.queryType === 'widget'}>
											{query.queryType || 'general'}
										</span>
									</div>
									{#if query.description}
										<span class="query-desc">{query.description}</span>
									{/if}
								</button>
								<button
									class="btn-icon btn-icon-sm"
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

			<div class="card">
				<h2>API Reference</h2>
				<div class="api-docs">
					<h3>Data Fetching</h3>
					<code>q.daily(&#123; year, month, week, from, to &#125;)</code>
					<p>Get daily records with metrics and tasks</p>

					<code>q.tasks(&#123; year, tag, completed &#125;)</code>
					<p>Get tasks with attributes and tags</p>

					<code>q.objectives(&#123; year, level &#125;)</code>
					<p>Get objectives with key results</p>

					<h3>Helpers</h3>
					<code>q.sum(items, 'field')</code>
					<code>q.avg(items, 'field')</code>
					<code>q.count(items)</code>
					<code>q.parseTime('7:30')</code>
					<code>q.formatDuration(450)</code>
					<code>q.formatPercent(3, 10)</code>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.queries-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: var(--spacing-lg);
	}

	.page-header {
		margin-bottom: var(--spacing-lg);
	}

	.page-header h1 {
		margin: 0 0 var(--spacing-xs);
	}

	.error-banner {
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		color: var(--color-error);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
	}

	.query-layout {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: var(--spacing-lg);
	}

	@media (max-width: 1024px) {
		.query-layout {
			grid-template-columns: 1fr;
		}
	}

	.editor-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.editor-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.editor-header h2 {
		margin: 0;
		font-size: 1rem;
	}

	.editor-actions {
		display: flex;
		gap: var(--spacing-sm);
	}

	.save-form {
		display: flex;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background-color: var(--color-bg);
		border-radius: var(--radius-sm);
	}

	.save-form .input {
		flex: 1;
	}

	.save-form .type-select {
		flex: 0 0 auto;
		width: auto;
		min-width: 120px;
	}

	.edit-type-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background-color: var(--color-bg);
		border-radius: var(--radius-sm);
	}

	.edit-type-row label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.edit-type-row .type-select {
		flex: 1;
	}

	.new-query-type-tabs {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background-color: var(--color-bg);
		border-radius: var(--radius-sm);
	}

	.new-query-type-tabs .type-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.new-query-type-tabs .type-tab {
		flex: none;
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.75rem;
	}

	.type-tabs {
		display: flex;
		gap: 2px;
		margin-bottom: var(--spacing-md);
		background-color: var(--color-bg);
		border-radius: var(--radius-sm);
		padding: 2px;
	}

	.type-tab {
		flex: 1;
		padding: var(--spacing-xs) var(--spacing-sm);
		border: none;
		background: transparent;
		font-size: 0.75rem;
		cursor: pointer;
		border-radius: var(--radius-sm);
		color: var(--color-text-muted);
		transition: all 0.15s ease;
	}

	.type-tab:hover {
		color: var(--color-text);
	}

	.type-tab.active {
		background-color: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-sm);
	}

	.query-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.query-type-badge {
		font-size: 0.625rem;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		background-color: var(--color-bg);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.query-type-badge.type-progress {
		background-color: rgb(59 130 246 / 0.15);
		color: rgb(59 130 246);
	}

	.query-type-badge.type-widget {
		background-color: rgb(139 92 246 / 0.15);
		color: rgb(139 92 246);
	}

	.code-editor {
		width: 100%;
		min-height: 400px;
		padding: var(--spacing-md);
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
		background-color: #1e1e1e;
		color: #d4d4d4;
		border: none;
		border-radius: var(--radius-md);
		resize: vertical;
		tab-size: 2;
	}

	.code-editor:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
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

	.saved-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.saved-section h2 {
		margin: 0 0 var(--spacing-md);
		font-size: 1rem;
	}

	.saved-queries-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.saved-queries-list li {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		border-bottom: 1px solid var(--color-border);
	}

	.saved-queries-list li:last-child {
		border-bottom: none;
	}

	.saved-queries-list li.active {
		background-color: rgb(59 130 246 / 0.1);
		margin: 0 calc(-1 * var(--spacing-lg));
		padding: 0 var(--spacing-lg);
	}

	.query-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--spacing-sm) 0;
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

	.api-docs {
		font-size: 0.875rem;
	}

	.api-docs h3 {
		margin: var(--spacing-md) 0 var(--spacing-xs);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.api-docs h3:first-child {
		margin-top: 0;
	}

	.api-docs code {
		display: block;
		padding: var(--spacing-xs) var(--spacing-sm);
		background-color: var(--color-bg);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		margin-bottom: var(--spacing-xs);
	}

	.api-docs p {
		margin: 0 0 var(--spacing-sm);
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}
</style>
