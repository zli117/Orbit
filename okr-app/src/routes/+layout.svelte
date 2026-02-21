<script lang="ts">
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import { invalidate } from '$app/navigation';
	import { browser } from '$app/environment';

	let { data, children } = $props();

	// Connect to SSE for real-time sync across devices
	$effect(() => {
		if (!browser || !data.user) return;

		const eventSource = new EventSource('/api/events');

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				// Invalidate the corresponding data dependency
				if (data.type && data.type.startsWith('data:')) {
					invalidate(data.type);
				}
			} catch {
				// Ignore parse errors (e.g., heartbeats)
			}
		};

		eventSource.onerror = () => {
			// EventSource will automatically reconnect
		};

		return () => {
			eventSource.close();
		};
	});
</script>

<svelte:head>
	<title>Orbit</title>
	<meta name="description" content="Track goals. Connect your data. Query your life." />
</svelte:head>

{#if data.user}
	<Nav user={data.user} />
{/if}

{@render children()}
