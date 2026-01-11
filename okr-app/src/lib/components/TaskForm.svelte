<script lang="ts">
	import TagInput from './TagInput.svelte';
	import type { Tag } from '$lib/types';

	interface Props {
		periodId?: string | null;
		getPeriodId?: () => Promise<string | null>;
		tags: Tag[];
		placeholder?: string;
		buttonLabel?: string;
		loadingLabel?: string;
		disabled?: boolean;
		onSuccess?: () => void;
		onError?: (error: string) => void;
		onTagCreated?: (tag: Tag) => void;
	}

	let {
		periodId = null,
		getPeriodId,
		tags,
		placeholder = 'Add a new task...',
		buttonLabel = 'Add Task',
		loadingLabel = 'Adding...',
		disabled = false,
		onSuccess,
		onError,
		onTagCreated
	}: Props = $props();

	let title = $state('');
	let progress = $state('');
	let expectedHours = $state('');
	let tagIds = $state<string[]>([]);
	let loading = $state(false);

	async function handleSubmit() {
		if (!title.trim()) return;

		loading = true;

		try {
			// Get period ID (either passed in or from callback)
			let resolvedPeriodId = periodId;
			if (!resolvedPeriodId && getPeriodId) {
				resolvedPeriodId = await getPeriodId();
			}
			if (!resolvedPeriodId) {
				throw new Error('No period available');
			}

			// Build attributes
			const attributes: Record<string, string> = {};
			const progressStr = String(progress).trim();
			const expectedHoursStr = String(expectedHours).trim();
			if (progressStr && progressStr !== '0') {
				attributes.progress = progressStr;
			}
			if (expectedHoursStr && expectedHoursStr !== '0') {
				attributes.expected_hours = expectedHoursStr;
			}

			const response = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					timePeriodId: resolvedPeriodId,
					title: title.trim(),
					attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
					tagIds: tagIds.length > 0 ? tagIds : undefined
				})
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to create task');
			}

			// Reset form
			title = '';
			progress = '';
			expectedHours = '';
			tagIds = [];

			onSuccess?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create task';
			onError?.(message);
		} finally {
			loading = false;
		}
	}

	async function handleCreateTag(name: string): Promise<Tag | null> {
		try {
			const response = await fetch('/api/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to create tag');
			}

			const { tag } = await response.json();
			onTagCreated?.(tag);
			return tag;
		} catch (err) {
			onError?.(err instanceof Error ? err.message : 'Failed to create tag');
			return null;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	const isDisabled = $derived(disabled || loading);
	const canSubmit = $derived(!isDisabled && title.trim().length > 0);
</script>

<form class="task-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<input
		type="text"
		class="input"
		{placeholder}
		bind:value={title}
		onkeydown={handleKeydown}
		disabled={isDisabled}
	/>
	<div class="task-form-options">
		<div class="option-row">
			<label class="option-label" for="task-progress">Progress</label>
			<input
				id="task-progress"
				type="number"
				class="input input-sm"
				bind:value={progress}
				placeholder="0"
				min="0"
				disabled={isDisabled}
			/>
		</div>
		<div class="option-row">
			<label class="option-label" for="task-hours">Expected Hours</label>
			<input
				id="task-hours"
				type="number"
				class="input input-sm"
				bind:value={expectedHours}
				placeholder="0"
				step="any"
				min="0"
				disabled={isDisabled}
			/>
		</div>
		<div class="option-row option-row-tags">
			<span class="option-label">Tags</span>
			<TagInput
				{tags}
				selectedTagIds={tagIds}
				onChange={(ids) => (tagIds = ids)}
				placeholder="Search or create tags..."
				disabled={isDisabled}
				allowCreate={true}
				onCreateTag={handleCreateTag}
			/>
		</div>
		<div class="option-row option-row-submit">
			<button class="btn btn-primary" type="submit" disabled={!canSubmit}>
				{loading ? loadingLabel : buttonLabel}
			</button>
		</div>
	</div>
</form>

<style>
	.task-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}

	.task-form-options {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}

	.option-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.option-row-tags {
		flex: 1;
		min-width: 200px;
	}

	.option-row-submit {
		margin-left: auto;
	}

	.option-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.input-sm {
		width: 80px;
	}
</style>
