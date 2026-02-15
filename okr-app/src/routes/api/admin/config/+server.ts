import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllConfig, setConfigValue, GLOBAL_CONFIG_FIELDS } from '$lib/server/config';
import { getRegisteredPlugins, initializePlugins } from '$lib/server/plugins';

// GET /api/admin/config - Get all config values and field definitions
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user?.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	initializePlugins();

	const config = await getAllConfig();
	const allPlugins = getRegisteredPlugins();

	const configMap: Record<string, string> = {};
	for (const entry of config) {
		if (!entry.isSecret) {
			configMap[entry.key] = entry.value;
		}
	}

	const pluginConfigs = await Promise.all(
		allPlugins.map(async (plugin) => ({
			id: plugin.id,
			name: plugin.name,
			description: plugin.description,
			icon: plugin.icon,
			configured: await plugin.isConfigured(),
			adminFields: plugin.getAdminConfigFields(),
			setupInfo: plugin.getSetupInfo(configMap)
		}))
	);

	return json({
		config,
		plugins: pluginConfigs,
		globalFields: GLOBAL_CONFIG_FIELDS
	});
};

// PUT /api/admin/config - Save config values
export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user?.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	const body = await request.json();
	const entries: Array<{ key: string; value: string; isSecret: boolean }> = body.entries;

	if (!Array.isArray(entries)) {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	let saved = 0;
	for (const entry of entries) {
		// Skip empty secret values (means admin didn't change the secret)
		if (entry.isSecret && entry.value === '') {
			continue;
		}

		await setConfigValue(entry.key, entry.value, entry.isSecret);
		saved++;
	}

	return json({ success: true, saved });
};
