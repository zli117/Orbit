/**
 * External Sources - Fetches metric values from external plugins (Fitbit, etc.)
 */

import { getPlugin, getUserPluginConfig } from '$lib/server/plugins/manager';
import type { MetricValues } from './evaluator';

interface ExternalSourceConfig {
	pluginId: string;
	fieldId: string;
}

/**
 * Parse an external source string like "fitbit.sleepLength"
 */
function parseSource(source: string): ExternalSourceConfig | null {
	const parts = source.split('.');
	if (parts.length !== 2) return null;
	return {
		pluginId: parts[0],
		fieldId: parts[1]
	};
}

/**
 * Fetch external metric values for a specific date
 */
export async function fetchExternalMetrics(
	userId: string,
	date: string,
	sourceIds: string[]
): Promise<MetricValues> {
	const values: MetricValues = {};

	// Group sources by plugin
	const sourcesByPlugin = new Map<string, string[]>();
	for (const sourceId of sourceIds) {
		const config = parseSource(sourceId);
		if (!config) continue;

		const fields = sourcesByPlugin.get(config.pluginId) || [];
		fields.push(config.fieldId);
		sourcesByPlugin.set(config.pluginId, fields);
	}

	// Fetch data from each plugin
	for (const [pluginId, fields] of sourcesByPlugin) {
		const plugin = getPlugin(pluginId);
		if (!plugin) continue;

		const config = await getUserPluginConfig(userId, pluginId);
		if (!config || !config.credentials) continue;

		try {
			// Fetch data for this specific date
			const records = await plugin.fetchData(
				config.credentials,
				date,
				date,
				fields
			);

			// Find the record for this date
			const record = records.find(r => r.date === date);
			if (record) {
				for (const fieldId of fields) {
					const value = record.fields[fieldId];
					values[`${pluginId}.${fieldId}`] = value ?? null;
				}
			}
		} catch (error) {
			console.error(`Error fetching data from ${pluginId}:`, error);
			// Set null values for failed fields
			for (const fieldId of fields) {
				values[`${pluginId}.${fieldId}`] = null;
			}
		}
	}

	return values;
}

/**
 * Get all external source IDs from a metrics template
 */
export function getExternalSourceIds(
	metrics: Array<{ type: string; source?: string }>
): string[] {
	return metrics
		.filter(m => m.type === 'external' && m.source)
		.map(m => m.source!);
}
