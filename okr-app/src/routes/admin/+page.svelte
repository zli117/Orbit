<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	interface UserData {
		id: string;
		username: string;
		isAdmin: boolean;
		isDisabled: boolean;
		weekStartDay: string;
		timezone: string;
		createdAt: Date;
	}

	interface LogData {
		id: string;
		userId: string;
		username: string;
		codeSnippet: string;
		success: boolean;
		errorMessage: string | null;
		executionTimeMs: number | null;
		createdAt: Date;
	}

	interface AdminConfigField {
		key: string;
		label: string;
		description?: string;
		type: 'text' | 'password' | 'url';
		required: boolean;
		placeholder?: string;
	}

	interface PluginConfigData {
		id: string;
		name: string;
		description: string;
		icon?: string;
		configured: boolean;
		adminFields: AdminConfigField[];
	}

	let { data } = $props();

	let activeTab = $state<'config' | 'users' | 'logs'>('config');
	let loading = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let expandedLogId = $state<string | null>(null);

	// Config tab state
	let configValues = $state<Record<string, string>>({});
	let savingConfig = $state(false);

	// Initialize config values from server data
	$effect.pre(() => {
		const values: Record<string, string> = {};
		for (const entry of data.systemConfig || []) {
			values[entry.key] = entry.value;
		}
		configValues = values;
	});

	function getConfigValue(key: string): string {
		return configValues[key] || '';
	}

	function setConfigFieldValue(key: string, value: string) {
		configValues = { ...configValues, [key]: value };
	}

	async function saveGlobalConfig() {
		savingConfig = true;
		message = null;

		try {
			const entries = (data.globalFields || []).map((field: AdminConfigField) => ({
				key: `global.${field.key}`,
				value: getConfigValue(`global.${field.key}`),
				isSecret: field.type === 'password'
			}));

			const response = await fetch('/api/admin/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entries })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to save');
			}

			message = { type: 'success', text: 'Global configuration saved' };
			await invalidateAll();
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to save' };
		} finally {
			savingConfig = false;
		}
	}

	async function savePluginConfig(plugin: PluginConfigData) {
		savingConfig = true;
		message = null;

		try {
			const entries = plugin.adminFields.map((field) => ({
				key: `plugin.${plugin.id}.${field.key}`,
				value: getConfigValue(`plugin.${plugin.id}.${field.key}`),
				isSecret: field.type === 'password'
			}));

			const response = await fetch('/api/admin/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entries })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to save');
			}

			message = { type: 'success', text: `${plugin.name} configuration saved` };
			await invalidateAll();
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to save' };
		} finally {
			savingConfig = false;
		}
	}

	function hasSecretSet(key: string): boolean {
		// If the key exists in systemConfig and is a secret, it means it's set
		return (data.systemConfig || []).some(
			(entry: { key: string; isSecret: boolean }) => entry.key === key && entry.isSecret
		);
	}

	function formatDate(date: Date | string) {
		const d = new Date(date);
		return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
	}

	function formatRelativeTime(date: Date | string) {
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	}

	async function toggleUserDisabled(userId: string, currentDisabled: boolean) {
		if (!confirm(currentDisabled ? 'Enable this user?' : 'Disable this user? They will be logged out.')) return;

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isDisabled: !currentDisabled })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to update user');
			}

			message = { type: 'success', text: currentDisabled ? 'User enabled' : 'User disabled' };
			await invalidateAll();
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to update user' };
		} finally {
			loading = false;
		}
	}

	async function toggleUserAdmin(userId: string, currentAdmin: boolean) {
		if (!confirm(currentAdmin ? 'Remove admin privileges?' : 'Grant admin privileges?')) return;

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isAdmin: !currentAdmin })
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to update user');
			}

			message = { type: 'success', text: currentAdmin ? 'Admin privileges removed' : 'Admin privileges granted' };
			await invalidateAll();
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to update user' };
		} finally {
			loading = false;
		}
	}

	async function deleteUser(userId: string, username: string) {
		if (!confirm(`Permanently delete user "${username}"? This cannot be undone and will delete all their data.`)) return;

		loading = true;
		message = null;

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to delete user');
			}

			message = { type: 'success', text: `User "${username}" deleted` };
			await invalidateAll();
		} catch (error) {
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to delete user' };
		} finally {
			loading = false;
		}
	}

	function toggleLogExpand(logId: string) {
		expandedLogId = expandedLogId === logId ? null : logId;
	}
</script>

<svelte:head>
	<title>Admin Dashboard | Orbit</title>
</svelte:head>

<main class="main-content">
	<h1 class="mb-lg">Admin Dashboard</h1>

	<!-- Stats Overview -->
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">{data.stats.users.total}</div>
			<div class="stat-label">Total Users</div>
			<div class="stat-detail">
				{data.stats.users.admins} admin{data.stats.users.admins !== 1 ? 's' : ''} ·
				{data.stats.users.disabled} disabled
			</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{data.stats.queries.last24h.total}</div>
			<div class="stat-label">Queries (24h)</div>
			<div class="stat-detail">
				{data.stats.queries.last24h.errors} error{data.stats.queries.last24h.errors !== 1 ? 's' : ''} ·
				avg {data.stats.queries.last24h.avgExecutionTimeMs}ms
			</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{data.stats.queries.last7d.total}</div>
			<div class="stat-label">Queries (7d)</div>
			<div class="stat-detail">
				{data.stats.queries.last7d.errors} error{data.stats.queries.last7d.errors !== 1 ? 's' : ''}
			</div>
		</div>
	</div>

	{#if message}
		<div class="message" class:success={message.type === 'success'} class:error={message.type === 'error'}>
			{message.text}
		</div>
	{/if}

	<!-- Tabs -->
	<div class="tabs">
		<button class="tab" class:active={activeTab === 'config'} onclick={() => (activeTab = 'config')}>
			Configuration
		</button>
		<button class="tab" class:active={activeTab === 'users'} onclick={() => (activeTab = 'users')}>
			Users ({data.users.length})
		</button>
		<button class="tab" class:active={activeTab === 'logs'} onclick={() => (activeTab = 'logs')}>
			Query Logs ({data.logs.length})
		</button>
	</div>

	<!-- Configuration Tab -->
	{#if activeTab === 'config'}
		<div class="config-section">
			<!-- Global Configuration -->
			<div class="config-card">
				<div class="config-card-header">
					<h2>Global Configuration</h2>
				</div>
				<form onsubmit={(e) => { e.preventDefault(); saveGlobalConfig(); }}>
					{#each data.globalFields || [] as field}
						<div class="form-group">
							<label for="global-{field.key}" class="form-label">{field.label}</label>
							{#if field.description}
								<p class="form-help">{field.description}</p>
							{/if}
							<input
								id="global-{field.key}"
								type={field.type === 'password' ? 'password' : 'text'}
								class="form-input"
								value={getConfigValue(`global.${field.key}`)}
								oninput={(e) => setConfigFieldValue(`global.${field.key}`, e.currentTarget.value)}
								placeholder={field.placeholder || ''}
							/>
						</div>
					{/each}
					<div class="config-actions">
						<button type="submit" class="btn btn-primary" disabled={savingConfig}>
							{savingConfig ? 'Saving...' : 'Save'}
						</button>
					</div>
				</form>
			</div>

			<!-- Plugin Configuration -->
			{#each data.pluginConfigs || [] as plugin}
				<div class="config-card">
					<div class="config-card-header">
						<div class="config-card-title">
							{#if plugin.icon}
								<span class="config-icon">{plugin.icon}</span>
							{/if}
							<div>
								<h2>{plugin.name}</h2>
								<p class="text-muted config-desc">{plugin.description}</p>
							</div>
						</div>
						{#if plugin.configured}
							<span class="badge badge-active">Configured</span>
						{:else}
							<span class="badge badge-not-configured">Not Configured</span>
						{/if}
					</div>
					{#if plugin.setupInfo?.length}
						<div class="setup-info">
							{#each plugin.setupInfo as info}
								<div class="setup-info-item">
									<span class="setup-info-label">{info.label}</span>
									{#if info.copyable}
										<button type="button" class="setup-info-value copyable" title="Click to copy"
											onclick={() => { navigator.clipboard.writeText(info.value); }}
										>{info.value}</button>
									{:else}
										<span class="setup-info-value">{info.value}</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					<form onsubmit={(e) => { e.preventDefault(); savePluginConfig(plugin); }}>
						{#each plugin.adminFields as field}
							{@const fullKey = `plugin.${plugin.id}.${field.key}`}
							<div class="form-group">
								<label for="plugin-{plugin.id}-{field.key}" class="form-label">{field.label}</label>
								{#if field.description}
									<p class="form-help">{field.description}</p>
								{/if}
								<input
									id="plugin-{plugin.id}-{field.key}"
									type={field.type === 'password' ? 'password' : 'text'}
									class="form-input"
									value={getConfigValue(fullKey)}
									oninput={(e) => setConfigFieldValue(fullKey, e.currentTarget.value)}
									placeholder={field.type === 'password' && hasSecretSet(fullKey) ? 'Currently set (leave blank to keep)' : field.placeholder || ''}
								/>
							</div>
						{/each}
						<div class="config-actions">
							<button type="submit" class="btn btn-primary" disabled={savingConfig}>
								{savingConfig ? 'Saving...' : 'Save'}
							</button>
						</div>
					</form>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Users Tab -->
	{#if activeTab === 'users'}
		<div class="users-section">
			{#if data.users.length === 0}
				<p class="text-muted">No users found.</p>
			{:else}
				<div class="users-table-container">
					<table class="users-table">
						<thead>
							<tr>
								<th>Username</th>
								<th>Status</th>
								<th>Role</th>
								<th>Created</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each data.users as user}
								<tr class:disabled={user.isDisabled}>
									<td>
										<span class="username">{user.username}</span>
										{#if user.id === data.user.id}
											<span class="badge badge-you">You</span>
										{/if}
									</td>
									<td>
										{#if user.isDisabled}
											<span class="badge badge-disabled">Disabled</span>
										{:else}
											<span class="badge badge-active">Active</span>
										{/if}
									</td>
									<td>
										{#if user.isAdmin}
											<span class="badge badge-admin">Admin</span>
										{:else}
											<span class="text-muted">User</span>
										{/if}
									</td>
									<td>
										<span class="date" title={formatDate(user.createdAt)}>
											{formatRelativeTime(user.createdAt)}
										</span>
									</td>
									<td>
										{#if user.id !== data.user.id}
											<div class="user-actions">
												<button
													class="btn btn-sm"
													class:btn-secondary={!user.isDisabled}
													class:btn-primary={user.isDisabled}
													onclick={() => toggleUserDisabled(user.id, user.isDisabled)}
													disabled={loading}
												>
													{user.isDisabled ? 'Enable' : 'Disable'}
												</button>
												<button
													class="btn btn-sm btn-secondary"
													onclick={() => toggleUserAdmin(user.id, user.isAdmin)}
													disabled={loading}
												>
													{user.isAdmin ? 'Remove Admin' : 'Make Admin'}
												</button>
												<button
													class="btn btn-sm btn-danger"
													onclick={() => deleteUser(user.id, user.username)}
													disabled={loading}
												>
													Delete
												</button>
											</div>
										{:else}
											<span class="text-muted">-</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Logs Tab -->
	{#if activeTab === 'logs'}
		<div class="logs-section">
			{#if data.logs.length === 0}
				<p class="text-muted">No query execution logs found.</p>
			{:else}
				<div class="logs-list">
					{#each data.logs as log}
						<div class="log-item" class:expanded={expandedLogId === log.id} class:error={!log.success}>
							<button class="log-header" onclick={() => toggleLogExpand(log.id)}>
								<div class="log-status">
									{#if log.success}
										<span class="status-icon success">✓</span>
									{:else}
										<span class="status-icon error">✗</span>
									{/if}
								</div>
								<div class="log-info">
									<span class="log-user">{log.username}</span>
									<span class="log-time">{formatRelativeTime(log.createdAt)}</span>
									{#if log.executionTimeMs}
										<span class="log-duration">{log.executionTimeMs}ms</span>
									{/if}
								</div>
								<div class="log-expand-icon">
									{expandedLogId === log.id ? '▼' : '▶'}
								</div>
							</button>
							{#if expandedLogId === log.id}
								<div class="log-details">
									<div class="log-meta">
										<strong>Time:</strong> {formatDate(log.createdAt)}
										{#if log.executionTimeMs}
											<br /><strong>Duration:</strong> {log.executionTimeMs}ms
										{/if}
									</div>
									<div class="log-code">
										<strong>Code:</strong>
										<pre>{log.codeSnippet}</pre>
									</div>
									{#if log.errorMessage}
										<div class="log-error">
											<strong>Error:</strong>
											<pre>{log.errorMessage}</pre>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</main>

<style>
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.stat-card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		text-align: center;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.stat-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		margin-top: var(--spacing-xs);
	}

	.stat-detail {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: var(--spacing-xs);
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

	.tabs {
		display: flex;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
		border-bottom: 1px solid var(--color-border);
	}

	.tab {
		background: none;
		border: none;
		padding: var(--spacing-sm) var(--spacing-md);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.users-table-container {
		overflow-x: auto;
	}

	.users-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.users-table th,
	.users-table td {
		padding: var(--spacing-sm) var(--spacing-md);
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.users-table th {
		font-weight: 600;
		color: var(--color-text-muted);
		background-color: var(--color-bg);
	}

	.users-table tr.disabled {
		opacity: 0.6;
	}

	.username {
		font-weight: 500;
	}

	.badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.badge-you {
		background-color: #dbeafe;
		color: #1d4ed8;
		margin-left: var(--spacing-xs);
	}

	.badge-active {
		background-color: #dcfce7;
		color: #15803d;
	}

	.badge-disabled {
		background-color: #fee2e2;
		color: #b91c1c;
	}

	.badge-admin {
		background-color: #fef3c7;
		color: #b45309;
	}

	.date {
		color: var(--color-text-muted);
	}

	.user-actions {
		display: flex;
		gap: var(--spacing-xs);
		flex-wrap: wrap;
	}

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.75rem;
	}

	.btn-danger {
		background-color: var(--color-error);
		color: white;
	}

	.btn-danger:hover {
		background-color: #dc2626;
	}

	.logs-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.log-item {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.log-item.error {
		border-left: 3px solid var(--color-error);
	}

	.log-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-sm) var(--spacing-md);
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.log-header:hover {
		background-color: var(--color-bg);
	}

	.log-status {
		flex-shrink: 0;
	}

	.status-icon {
		display: inline-block;
		width: 20px;
		height: 20px;
		line-height: 20px;
		text-align: center;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: bold;
	}

	.status-icon.success {
		background-color: #dcfce7;
		color: #15803d;
	}

	.status-icon.error {
		background-color: #fee2e2;
		color: #b91c1c;
	}

	.log-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		flex-wrap: wrap;
	}

	.log-user {
		font-weight: 500;
	}

	.log-time {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.log-duration {
		color: var(--color-text-muted);
		font-size: 0.75rem;
		background-color: var(--color-bg);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.log-expand-icon {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.log-details {
		padding: var(--spacing-md);
		border-top: 1px solid var(--color-border);
		background-color: var(--color-bg);
	}

	.log-meta {
		font-size: 0.875rem;
		margin-bottom: var(--spacing-sm);
	}

	.log-code,
	.log-error {
		margin-top: var(--spacing-sm);
	}

	.log-code pre,
	.log-error pre {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: var(--spacing-sm);
		overflow-x: auto;
		font-size: 0.75rem;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.log-error pre {
		background-color: #fef2f2;
		border-color: #fecaca;
		color: var(--color-error);
	}

	/* Configuration Tab */
	.config-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.config-card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
	}

	.config-card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.config-card-header h2 {
		margin: 0;
		font-size: 1.125rem;
	}

	.config-card-title {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
	}

	.config-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.config-desc {
		margin: var(--spacing-xs) 0 0;
		font-size: 0.875rem;
	}

	.badge-not-configured {
		background-color: #fef3c7;
		color: #92400e;
		white-space: nowrap;
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-label {
		display: block;
		font-weight: 500;
		font-size: 0.875rem;
		margin-bottom: var(--spacing-xs);
	}

	.form-help {
		margin: 0 0 var(--spacing-xs);
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.form-input {
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		background-color: var(--color-bg);
		color: var(--color-text);
	}

	.form-input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
	}

	.setup-info {
		background-color: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-sm) var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.setup-info-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 0.875rem;
	}

	.setup-info-item + .setup-info-item {
		margin-top: var(--spacing-xs);
	}

	.setup-info-label {
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.setup-info-value {
		font-weight: 500;
	}

	.setup-info-value.copyable {
		background-color: var(--color-bg-hover);
		padding: 2px var(--spacing-xs);
		border-radius: var(--radius-sm);
		cursor: pointer;
		user-select: all;
		word-break: break-all;
		font-size: 0.8125rem;
	}

	.setup-info-value.copyable:hover {
		background-color: var(--color-border);
	}

	.config-actions {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}
</style>
