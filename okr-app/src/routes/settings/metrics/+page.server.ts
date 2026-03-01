import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { metricsTemplates } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { getRegisteredPlugins } from '$lib/server/plugins/manager';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('data:metrics');

	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Get all templates for this user
	const templates = await db.query.metricsTemplates.findMany({
		where: eq(metricsTemplates.userId, locals.user.id),
		orderBy: [desc(metricsTemplates.effectiveFrom)]
	});

	// Get available external sources from plugins
	const plugins = getRegisteredPlugins();
	const externalSources = plugins.map(plugin => ({
		pluginId: plugin.id,
		pluginName: plugin.name,
		fields: plugin.getAvailableFields().map(field => ({
			id: `${plugin.id}.${field.id}`,
			name: field.name,
			description: field.description,
			type: field.type,
			unit: field.unit
		}))
	}));

	return {
		templates: templates.map(t => ({
			...t,
			metricsDefinition: JSON.parse(t.metricsDefinition)
		})),
		externalSources
	};
};
