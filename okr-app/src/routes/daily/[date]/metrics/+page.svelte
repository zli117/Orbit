<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { MetricDefinition } from '$lib/db/schema';

	let { data } = $props();

	let loading = $state(false);
	let error = $state('');
	let success = $state('');

	// Form values - initialized from server data
	let formValues = $state<Record<string, string | number | boolean | null>>({});

	// Computed values (read-only, updated after save)
	let computedValues = $state<Record<string, string | number | boolean | null>>({});

	// Sync from server data
	$effect.pre(() => {
		formValues = { ...data.values };
		computedValues = Object.fromEntries(
			data.metricsDefinition
				.filter((m: MetricDefinition) => m.type === 'computed' || m.type === 'external')
				.map((m: MetricDefinition) => [m.name, data.values[m.name] ?? null])
		);
	});

	const dateObj = $derived(new Date(data.date + 'T00:00:00'));
	const formattedDate = $derived(
		dateObj.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);

	// Check if we have a template
	const hasTemplate = $derived(data.template !== null && data.metricsDefinition.length > 0);

	async function saveFlexibleMetrics() {
		loading = true;
		error = '';
		success = '';

		// Collect only input values
		const inputValues: Record<string, string | number | boolean | null> = {};
		for (const metric of data.metricsDefinition) {
			if (metric.type === 'input') {
				inputValues[metric.name] = formValues[metric.name] ?? null;
			}
		}

		try {
			const response = await fetch(`/api/metrics/flexible/${data.date}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ values: inputValues })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to save metrics');
			}

			// Update computed values from response
			if (result.values) {
				for (const metric of data.metricsDefinition) {
					if (metric.type === 'computed' || metric.type === 'external') {
						computedValues[metric.name] = result.values[metric.name] ?? null;
					}
				}
			}

			success = 'Metrics saved successfully!';
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save metrics';
		} finally {
			loading = false;
		}
	}

	function goBack() {
		goto(`/daily/${data.date}`);
	}

	function getInputValue(metricName: string): string {
		const val = formValues[metricName];
		if (val === null || val === undefined) return '';
		return String(val);
	}

	function setInputValue(metricName: string, value: string, inputType: string | undefined) {
		if (inputType === 'number') {
			formValues[metricName] = value ? parseFloat(value) : null;
		} else if (inputType === 'boolean') {
			formValues[metricName] = value === 'true';
		} else {
			formValues[metricName] = value || null;
		}
	}

	function formatValue(value: string | number | boolean | null): string {
		if (value === null || value === undefined) return '-';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		return String(value);
	}
</script>

<svelte:head>
	<title>Edit Metrics - {formattedDate} - RUOK</title>
</svelte:head>

<div class="metrics-page">
	<header class="page-header">
		<button class="btn btn-secondary" onclick={goBack}>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
			Back
		</button>
		<h1>Edit Metrics</h1>
		<a href="/settings/metrics" class="btn btn-secondary btn-sm">Manage Templates</a>
	</header>

	<p class="date-subtitle">{formattedDate}</p>

	{#if data.template}
		<p class="template-info">Using template: <strong>{data.template.name}</strong> (effective from {data.template.effectiveFrom})</p>
	{/if}

	{#if error}
		<div class="error-banner">{error}</div>
	{/if}

	{#if success}
		<div class="success-banner">{success}</div>
	{/if}

	{#if hasTemplate}
		<!-- Flexible metrics form based on template -->
		<form class="card metrics-form" onsubmit={(e) => { e.preventDefault(); saveFlexibleMetrics(); }}>
			{#each data.metricsDefinition as metric}
				<div class="metric-field" class:computed={metric.type === 'computed'} class:external={metric.type === 'external'}>
					<label class="label" for={`metric-${metric.name}`}>
						{metric.label}
						{#if metric.unit}
							<span class="unit">({metric.unit})</span>
						{/if}
						{#if metric.type === 'computed'}
							<span class="type-badge computed">Computed</span>
						{:else if metric.type === 'external'}
							<span class="type-badge external">External</span>
						{/if}
					</label>

					{#if metric.type === 'input'}
						{#if metric.inputType === 'boolean'}
							<select
								id={`metric-${metric.name}`}
								class="input"
								value={formValues[metric.name] === true || formValues[metric.name] === 'true' ? 'true' : formValues[metric.name] === false || formValues[metric.name] === 'false' ? 'false' : ''}
								onchange={(e) => setInputValue(metric.name, e.currentTarget.value, 'boolean')}
							>
								<option value="">Not set</option>
								<option value="true">Yes</option>
								<option value="false">No</option>
							</select>
						{:else if metric.inputType === 'time'}
							<input
								type="time"
								id={`metric-${metric.name}`}
								class="input"
								value={getInputValue(metric.name)}
								oninput={(e) => setInputValue(metric.name, e.currentTarget.value, 'time')}
							/>
						{:else if metric.inputType === 'number'}
							<input
								type="number"
								id={`metric-${metric.name}`}
								class="input"
								value={getInputValue(metric.name)}
								oninput={(e) => setInputValue(metric.name, e.currentTarget.value, 'number')}
								step="any"
							/>
						{:else}
							<input
								type="text"
								id={`metric-${metric.name}`}
								class="input"
								value={getInputValue(metric.name)}
								oninput={(e) => setInputValue(metric.name, e.currentTarget.value, 'text')}
							/>
						{/if}
					{:else}
						<!-- Computed and external values are read-only -->
						<div class="readonly-value" id={`metric-${metric.name}`}>
							{formatValue(computedValues[metric.name] ?? data.values[metric.name])}
							{#if data.errors[metric.name]}
								<span class="error-hint" title={data.errors[metric.name]}>!</span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			<div class="form-actions">
				<button type="button" class="btn btn-secondary" onclick={goBack}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={loading}>
					{loading ? 'Saving...' : 'Save Metrics'}
				</button>
			</div>
		</form>
	{:else}
		<!-- No template configured -->
		<div class="card no-template-card">
			<div class="no-template-icon">📊</div>
			<h2>No Metrics Template</h2>
			<p class="text-muted">Create a metrics template to define what daily metrics you want to track.</p>
			<p class="text-muted text-sm">Templates let you define input fields, computed values, and external data sources (like Fitbit).</p>
			<a href="/settings/metrics" class="btn btn-primary">Create Template</a>
		</div>
	{/if}
</div>

<style>
	.metrics-page {
		max-width: 700px;
		margin: 0 auto;
		padding: var(--spacing-lg);
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-sm);
	}

	.page-header h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.date-subtitle {
		text-align: center;
		color: var(--color-text-muted);
		margin-bottom: var(--spacing-sm);
	}

	.template-info {
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-bottom: var(--spacing-lg);
	}

	.template-info strong {
		color: var(--color-primary);
	}

	.no-template-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: var(--spacing-xl);
		gap: var(--spacing-sm);
	}

	.no-template-card h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.no-template-card p {
		margin: 0;
		max-width: 400px;
	}

	.no-template-icon {
		font-size: 3rem;
		margin-bottom: var(--spacing-sm);
	}

	.text-sm {
		font-size: 0.875rem;
	}

	.error-banner {
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		color: var(--color-error);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
	}

	.success-banner {
		background-color: #f0fdf4;
		border: 1px solid #bbf7d0;
		color: var(--color-success);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
	}

	.metrics-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.metric-field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.metric-field.computed,
	.metric-field.external {
		background-color: var(--color-bg);
		padding: var(--spacing-sm);
		border-radius: var(--radius-sm);
	}

	.metric-field .label {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.unit {
		font-weight: normal;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.type-badge {
		font-size: 0.625rem;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.5px;
	}

	.type-badge.computed {
		background-color: #fef3c7;
		color: #92400e;
	}

	.type-badge.external {
		background-color: #f3e8ff;
		color: #7c3aed;
	}

	.readonly-value {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm);
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		color: var(--color-text);
	}

	.error-hint {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		background-color: var(--color-error);
		color: white;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: bold;
		cursor: help;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-sm);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}
</style>
