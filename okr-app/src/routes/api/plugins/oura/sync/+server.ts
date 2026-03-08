import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncPluginData, getUserPluginConfig } from '$lib/server/plugins/manager';

// POST /api/plugins/oura/sync - Sync Oura data
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Check if plugin is configured
	const config = await getUserPluginConfig(locals.user.id, 'oura');
	if (!config || !config.credentials) {
		return json({ error: 'Oura not connected' }, { status: 400 });
	}

	try {
		const body = await request.json().catch(() => ({}));

		// Default to last 7 days
		const today = new Date();
		const weekAgo = new Date(today);
		weekAgo.setDate(weekAgo.getDate() - 7);

		const startDate = body.startDate || formatDate(weekAgo);
		const endDate = body.endDate || formatDate(today);

		const result = await syncPluginData(locals.user.id, 'oura', startDate, endDate);

		return json(result);
	} catch (error) {
		console.error('Oura sync failed:', error);
		return json({ error: 'Sync failed' }, { status: 500 });
	}
};

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
