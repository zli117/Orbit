import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserPluginConfig, disableUserPlugin } from '$lib/server/plugins/manager';
import { ouraPlugin } from '$lib/server/plugins/oura';

// GET /api/plugins/oura - Get Oura plugin status
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const config = await getUserPluginConfig(locals.user.id, 'oura');

	return json({
		plugin: {
			id: ouraPlugin.id,
			name: ouraPlugin.name,
			description: ouraPlugin.description,
			icon: ouraPlugin.icon,
			fields: ouraPlugin.getAvailableFields()
		},
		connected: !!(config?.credentials),
		enabled: config?.enabled ?? false,
		lastSync: config?.lastSync ?? null
	});
};

// DELETE /api/plugins/oura - Disconnect Oura
export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	await disableUserPlugin(locals.user.id, 'oura');

	return json({ success: true });
};
