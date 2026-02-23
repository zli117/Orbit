<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let loading = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// New tag form
	let showNewTag = $state(false);
	let newTagName = $state('');
	let newTagColor = $state('#3b82f6');
	let newTagCategory = $state('');

	// Edit tag
	let editingTag = $state<typeof data.tags[0] | null>(null);
	let editTagName = $state('');
	let editTagColor = $state('');
	let editTagCategory = $state('');

	const presetColors = [
		'#ef4444', '#f97316', '#f59e0b', '#eab308',
		'#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
		'#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
		'#d946ef', '#ec4899', '#f43f5e', '#64748b'
	];

	function resetNewTagForm() {
		newTagName = '';
		newTagColor = '#3b82f6';
		newTagCategory = '';
		showNewTag = false;
	}

	function openEditTag(tag: typeof data.tags[0]) {
		editingTag = tag;
		editTagName = tag.name;
		editTagColor = tag.color || '#3b82f6';
		editTagCategory = tag.category || '';
	}

	function closeEditTag() {
		editingTag = null;
		editTagName = '';
		editTagColor = '';
		editTagCategory = '';
	}

	async function createTag() {
		if (!newTagName.trim()) return;

		loading = true;
		message = null;

		try {
			const response = await fetch('/api/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newTagName.trim(),
					color: newTagColor || null,
					category: newTagCategory.trim() || null
				})
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to create tag');
			}

			message = { type: 'success', text: 'Tag created' };
			resetNewTagForm();
			await invalidateAll();
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to create tag' };
		} finally {
			loading = false;
		}
	}

	async function updateTag() {
		if (!editingTag || !editTagName.trim()) return;

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/tags/${editingTag.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editTagName.trim(),
					color: editTagColor || null,
					category: editTagCategory.trim() || null
				})
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to update tag');
			}

			message = { type: 'success', text: 'Tag updated' };
			closeEditTag();
			await invalidateAll();
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to update tag' };
		} finally {
			loading = false;
		}
	}

	async function deleteTag(id: string) {
		if (!confirm('Delete this tag? It will be removed from all tasks.')) return;

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/tags/${id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete tag');
			}

			message = { type: 'success', text: 'Tag deleted' };
			await invalidateAll();
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to delete tag' };
		} finally {
			loading = false;
		}
	}

	// Group tags by category
	const groupedTags = $derived(() => {
		const groups: Record<string, typeof data.tags> = {};
		for (const tag of data.tags) {
			const category = tag.category || 'Uncategorized';
			if (!groups[category]) {
				groups[category] = [];
			}
			groups[category].push(tag);
		}
		return groups;
	});
</script>

<svelte:head>
	<title>Tags - Settings - RUOK</title>
</svelte:head>

<div class="tags-page">
	<header class="page-header">
		<a href="/settings" class="back-link">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
			Back to Settings
		</a>
		<h1>Tags</h1>
		<p class="page-description">Manage tags for organizing your tasks. Tags can be assigned to tasks and used for filtering and queries.</p>
	</header>

	{#if message}
		<div class="message" class:success={message.type === 'success'} class:error={message.type === 'error'}>
			{message.text}
		</div>
	{/if}

	<div class="tags-content">
		{#if data.tags.length > 0}
			<div class="tags-list">
				{#each Object.entries(groupedTags()) as [category, categoryTags]}
					<div class="tag-category">
						<h3 class="category-name">{category}</h3>
						<div class="category-tags">
							{#each categoryTags as tag}
								<div class="tag-item">
									<span
										class="tag-chip"
										style={tag.color ? `background-color: ${tag.color}20; color: ${tag.color}; border-color: ${tag.color}` : ''}
									>
										{tag.name}
									</span>
									<div class="tag-actions">
										<button class="action-btn" onclick={() => openEditTag(tag)} title="Edit">
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/>
											</svg>
										</button>
										<button class="action-btn action-btn-danger" onclick={() => deleteTag(tag.id)} title="Delete">
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
											</svg>
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
					<line x1="7" y1="7" x2="7.01" y2="7"/>
				</svg>
				<h3>No tags yet</h3>
				<p>Create tags to organize and categorize your tasks.</p>
			</div>
		{/if}

		{#if showNewTag}
			<div class="card tag-form">
				<h3>New Tag</h3>
				<div class="form-group">
					<label class="label" for="tag-name">Name</label>
					<input
						type="text"
						id="tag-name"
						class="input"
						placeholder="e.g., Work, Personal, Important"
						bind:value={newTagName}
					/>
				</div>
				<div class="form-group">
					<span class="label" id="new-tag-color-label">Color</span>
					<div class="color-picker" role="group" aria-labelledby="new-tag-color-label">
						{#each presetColors as color}
							<button
								type="button"
								class="color-option"
								class:selected={newTagColor === color}
								style="background-color: {color}"
								onclick={() => newTagColor = color}
								aria-label="Select color {color}"
							></button>
						{/each}
					</div>
					<div class="color-preview">
						<span
							class="tag-chip preview"
							style="background-color: {newTagColor}20; color: {newTagColor}; border-color: {newTagColor}"
						>
							{newTagName || 'Preview'}
						</span>
					</div>
				</div>
				<div class="form-group">
					<label class="label" for="tag-category">Category (optional)</label>
					<input
						type="text"
						id="tag-category"
						class="input"
						placeholder="e.g., Projects, Areas, Context"
						bind:value={newTagCategory}
					/>
				</div>
				<div class="form-actions">
					<button type="button" class="btn btn-secondary" onclick={resetNewTagForm}>Cancel</button>
					<button
						type="button"
						class="btn btn-primary"
						onclick={createTag}
						disabled={loading || !newTagName.trim()}
					>
						{loading ? 'Creating...' : 'Create Tag'}
					</button>
				</div>
			</div>
		{:else}
			<button class="btn btn-primary add-btn" onclick={() => showNewTag = true}>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"/>
					<line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				New Tag
			</button>
		{/if}
	</div>
</div>

{#if editingTag}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={closeEditTag} onkeydown={(e) => e.key === 'Escape' && closeEditTag()} role="dialog" aria-modal="true" tabindex="-1">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Edit Tag</h3>
				<button class="action-btn" onclick={closeEditTag} aria-label="Close">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label class="label" for="edit-tag-name">Name</label>
					<input
						type="text"
						id="edit-tag-name"
						class="input"
						bind:value={editTagName}
					/>
				</div>
				<div class="form-group">
					<span class="label" id="edit-tag-color-label">Color</span>
					<div class="color-picker" role="group" aria-labelledby="edit-tag-color-label">
						{#each presetColors as color}
							<button
								type="button"
								class="color-option"
								class:selected={editTagColor === color}
								style="background-color: {color}"
								onclick={() => editTagColor = color}
								aria-label="Select color {color}"
							></button>
						{/each}
					</div>
					<div class="color-preview">
						<span
							class="tag-chip preview"
							style="background-color: {editTagColor}20; color: {editTagColor}; border-color: {editTagColor}"
						>
							{editTagName || 'Preview'}
						</span>
					</div>
				</div>
				<div class="form-group">
					<label class="label" for="edit-tag-category">Category (optional)</label>
					<input
						type="text"
						id="edit-tag-category"
						class="input"
						bind:value={editTagCategory}
					/>
				</div>
				<div class="form-actions">
					<button type="button" class="btn btn-secondary" onclick={closeEditTag}>Cancel</button>
					<button
						type="button"
						class="btn btn-primary"
						onclick={updateTag}
						disabled={loading || !editTagName.trim()}
					>
						{loading ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.tags-page {
		max-width: 800px;
		margin: 0 auto;
		padding: var(--spacing-lg);
	}

	.page-header {
		margin-bottom: var(--spacing-xl);
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		color: var(--color-text-muted);
		text-decoration: none;
		font-size: 0.875rem;
		margin-bottom: var(--spacing-sm);
	}

	.back-link:hover {
		color: var(--color-primary);
	}

	.page-header h1 {
		margin: 0 0 var(--spacing-xs);
	}

	.page-description {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.message {
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-md);
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

	.tags-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.tags-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.tag-category {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-md);
	}

	.category-name {
		margin: 0 0 var(--spacing-sm);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-text-muted);
	}

	.category-tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.tag-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-bg);
		border-radius: var(--radius-md);
		transition: background 0.15s;
	}

	.tag-item:hover {
		background: var(--color-bg-hover);
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: 14px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid currentColor;
		background: var(--color-bg);
	}

	.tag-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.tag-item:hover .tag-actions {
		opacity: 1;
	}

	.action-btn {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s;
	}

	.action-btn:hover {
		background: var(--color-surface);
		color: var(--color-primary);
	}

	.action-btn-danger:hover {
		background: #fef2f2;
		color: var(--color-error);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--spacing-xl);
		background: var(--color-surface);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-lg);
		text-align: center;
		color: var(--color-text-muted);
	}

	.empty-state svg {
		margin-bottom: var(--spacing-md);
		opacity: 0.4;
	}

	.empty-state h3 {
		margin: 0 0 var(--spacing-xs);
		color: var(--color-text);
	}

	.empty-state p {
		margin: 0;
		font-size: 0.875rem;
	}

	.tag-form {
		padding: var(--spacing-lg);
	}

	.tag-form h3 {
		margin: 0 0 var(--spacing-md);
	}

	.color-picker {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
		margin-bottom: var(--spacing-sm);
	}

	.color-option {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform 0.15s, border-color 0.15s;
	}

	.color-option:hover {
		transform: scale(1.1);
	}

	.color-option.selected {
		border-color: var(--color-text);
		transform: scale(1.1);
	}

	.color-preview {
		margin-top: var(--spacing-sm);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-md);
	}

	.add-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--spacing-md);
	}

	.modal {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		max-width: 400px;
		width: 100%;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-md) var(--spacing-lg);
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h3 {
		margin: 0;
	}

	.modal-body {
		padding: var(--spacing-lg);
	}
</style>
