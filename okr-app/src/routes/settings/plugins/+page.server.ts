import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserPluginConfig, getRegisteredPlugins, initializePlugins } from '$lib/server/plugins';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Initialize plugins
	initializePlugins();

	// Get all registered plugins
	const allPlugins = getRegisteredPlugins();

	// Non-admin users only see plugins the admin has configured
	const isAdmin = locals.user.isAdmin;
	const plugins = isAdmin ? allPlugins : allPlugins.filter(p => p.isConfigured());

	// Get user's plugin configurations
	const pluginStatuses = await Promise.all(
		plugins.map(async (plugin) => {
			const config = await getUserPluginConfig(locals.user!.id, plugin.id);
			return {
				id: plugin.id,
				name: plugin.name,
				description: plugin.description,
				icon: plugin.icon,
				fields: plugin.getAvailableFields(),
				configured: plugin.isConfigured(),
				connected: !!(config?.credentials),
				enabled: config?.enabled ?? false,
				lastSync: config?.lastSync ?? null
			};
		})
	);

	// Check for success/error messages
	const success = url.searchParams.get('success');
	const error = url.searchParams.get('error');

	return {
		plugins: pluginStatuses,
		isAdmin,
		success,
		error
	};
};
