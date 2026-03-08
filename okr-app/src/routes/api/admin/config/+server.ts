import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllConfig, setConfigValue, GLOBAL_CONFIG_FIELDS } from '$lib/server/config';
import { getRegisteredPlugins, initializePlugins } from '$lib/server/plugins';

// Build an allowlist of valid config keys and their expected isSecret flag
function buildAllowedKeys(): Map<string, boolean> {
	const allowed = new Map<string, boolean>();
	for (const field of GLOBAL_CONFIG_FIELDS) {
		allowed.set(`global.${field.key}`, field.type === 'password');
	}
	for (const plugin of getRegisteredPlugins()) {
		for (const field of plugin.getAdminConfigFields()) {
			allowed.set(`plugin.${plugin.id}.${field.key}`, field.type === 'password');
		}
	}
	return allowed;
}

// GET /api/admin/config - Get all config values and field definitions
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!locals.user.isAdmin) {
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
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	initializePlugins();

	const body = await request.json();
	const entries: Array<{ key: string; value: string; isSecret: boolean }> = body.entries;

	if (!Array.isArray(entries)) {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	// Validate keys against the allowlist and enforce isSecret from field definitions
	const allowedKeys = buildAllowedKeys();

	let saved = 0;
	for (const entry of entries) {
		if (!allowedKeys.has(entry.key)) {
			continue; // Silently skip unknown keys
		}

		// Enforce isSecret based on field type definition, not client-supplied value
		const mustBeSecret = allowedKeys.get(entry.key)!;

		// Skip empty secret values (means admin didn't change the secret)
		if (mustBeSecret && entry.value === '') {
			continue;
		}

		await setConfigValue(entry.key, entry.value, mustBeSecret);
		saved++;
	}

	return json({ success: true, saved });
};
