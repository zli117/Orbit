<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { User } from '$lib/types';

	interface Props {
		user: User;
	}

	let { user }: Props = $props();
	let menuOpen = $state(false);

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login', { invalidateAll: true });
	}

	function isActive(path: string): boolean {
		return $page.url.pathname.startsWith(path);
	}

	function closeMenu() {
		menuOpen = false;
	}
</script>

<nav class="nav">
	<div class="nav-inner">
		<a href="/" class="nav-brand">
			<img src="/ruok-logo.svg" alt="RUOK" class="nav-logo" />
		</a>

		<button class="menu-toggle" onclick={() => menuOpen = !menuOpen} aria-label="Toggle menu">
			<span class="menu-icon" class:open={menuOpen}>
				<span></span>
				<span></span>
				<span></span>
			</span>
		</button>

		<div class="nav-links" class:open={menuOpen}>
			<a href="/daily" class="nav-link" class:active={isActive('/daily')} onclick={closeMenu}>Daily</a>
			<a href="/weekly" class="nav-link" class:active={isActive('/weekly')} onclick={closeMenu}>Weekly</a>
			<a href="/objectives" class="nav-link" class:active={isActive('/objectives')} onclick={closeMenu}>Objectives</a>
			<a href="/queries" class="nav-link" class:active={isActive('/queries')} onclick={closeMenu}>Queries</a>
			<a href="/friends" class="nav-link" class:active={isActive('/friends')} onclick={closeMenu}>Friends</a>
			<a href="/settings" class="nav-link" class:active={isActive('/settings')} onclick={closeMenu}>Settings</a>
			{#if user.isAdmin}
				<a href="/admin" class="nav-link nav-link-admin" class:active={isActive('/admin')} onclick={closeMenu}>Admin</a>
			{/if}
			<span class="nav-separator"></span>
			<span class="nav-user">{user.username}</span>
			<button class="btn btn-secondary btn-sm" onclick={handleLogout}>Logout</button>
		</div>
	</div>
</nav>


<style>
	.nav {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(203, 213, 225, 0.5);
		padding: var(--spacing-xs) var(--spacing-lg);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-inner {
		display: flex;
		align-items: center;
		width: 100%;
		padding-left: 20%;
		padding-right: 20%;
	}

	.nav-brand {
		display: flex;
		align-items: center;
		text-decoration: none;
		margin-right: var(--spacing-lg);
		flex-shrink: 0;
	}

	.nav-brand:hover {
		text-decoration: none;
		opacity: 0.85;
	}

	.nav-logo {
		height: 38px;
		width: auto;
	}

	.menu-toggle {
		display: none;
		background: none;
		border: none;
		padding: var(--spacing-sm);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		margin-left: auto;
	}

	.menu-icon {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 24px;
	}

	.menu-icon span {
		display: block;
		height: 2px;
		background-color: var(--color-text);
		border-radius: 1px;
		transition: all 0.3s ease;
	}

	.menu-icon.open span:nth-child(1) {
		transform: translateY(6px) rotate(45deg);
	}

	.menu-icon.open span:nth-child(2) {
		opacity: 0;
	}

	.menu-icon.open span:nth-child(3) {
		transform: translateY(-6px) rotate(-45deg);
	}

	.nav-links {
		display: flex;
		gap: var(--spacing-sm);
		align-items: center;
		flex: 1;
		justify-content: flex-end;
	}

	.nav-link {
		color: var(--color-text);
		text-decoration: none;
		font-size: 0.875rem;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-sm);
		transition: all 0.15s ease;
		-webkit-tap-highlight-color: transparent;
		white-space: nowrap;
	}

	.nav-link:hover {
		text-decoration: none;
		background-color: var(--color-bg-hover);
	}

	.nav-link.active {
		color: var(--color-primary);
		background-color: var(--color-bg-hover);
		font-weight: 600;
	}

	.nav-link-admin {
		color: var(--color-warning);
	}

	.nav-link-admin:hover {
		background-color: rgb(245 158 11 / 0.1);
	}

	.nav-link-admin.active {
		color: var(--color-warning);
		background-color: rgb(245 158 11 / 0.1);
	}

	.nav-separator {
		width: 1px;
		height: 20px;
		background-color: var(--color-border);
		flex-shrink: 0;
	}

	.nav-user {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.btn-sm {
		padding: var(--spacing-sm) var(--spacing-md);
		font-size: 0.875rem;
		min-height: 44px;
		white-space: nowrap;
	}

	/* Mobile styles */
	@media (max-width: 768px) {
		.nav {
			padding: var(--spacing-sm) 5%;
		}

		.nav-inner {
			padding-left: 0;
			padding-right: 0;
		}

		.menu-toggle {
			display: block;
		}

		.nav-links {
			position: fixed;
			top: 0;
			right: 0;
			width: 280px;
			height: 100vh;
			background: rgba(255, 255, 255, 0.95);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			border-left: 1px solid rgba(203, 213, 225, 0.5);
			box-shadow: -4px 0 20px rgb(0 0 0 / 0.1);
			z-index: 200;
			flex-direction: column;
			padding: var(--spacing-xl) var(--spacing-lg);
			gap: var(--spacing-xs);
			justify-content: flex-start;
			transform: translateX(100%);
			transition: transform 0.25s ease;
			overflow-y: auto;
			visibility: hidden;
		}

		.nav-links.open {
			transform: translateX(0);
			visibility: visible;
		}

		.nav-link {
			width: 100%;
			padding: var(--spacing-md);
			font-size: 1rem;
			min-height: 48px;
			display: flex;
			align-items: center;
			border-radius: var(--radius-md);
		}

		.nav-separator {
			width: 100%;
			height: 1px;
			margin: var(--spacing-sm) 0;
		}

		.nav-user {
			padding: var(--spacing-sm) var(--spacing-md);
			font-size: 1rem;
		}

		.btn-sm {
			width: 100%;
			justify-content: center;
			padding: var(--spacing-md);
			font-size: 1rem;
		}
	}
</style>
