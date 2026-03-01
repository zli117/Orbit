/**
 * External Sources - Fetches metric values from external plugins (Fitbit, etc.)
 *
 * First checks dailyMetricValues for previously synced data.
 * Falls back to live API calls only for missing values.
 */

import { db } from '$lib/db/client';
import { dailyMetricValues } from '$lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
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
 * Fetch external metric values for a specific date.
 * Reads from dailyMetricValues (synced data) first, then falls back to live API.
 */
export async function fetchExternalMetrics(
	userId: string,
	date: string,
	sourceIds: string[]
): Promise<MetricValues> {
	const values: MetricValues = {};

	if (sourceIds.length === 0) return values;

	// Check dailyMetricValues for already-synced data
	const storedValues = await db.query.dailyMetricValues.findMany({
		where: and(
			eq(dailyMetricValues.userId, userId),
			eq(dailyMetricValues.date, date),
			inArray(dailyMetricValues.metricName, sourceIds)
		)
	});

	const storedMap = new Map(storedValues.map(v => [v.metricName, v.value]));

	// Identify which source IDs still need fetching
	const missingSourceIds = sourceIds.filter(id => !storedMap.has(id));

	// Use stored values
	for (const sourceId of sourceIds) {
		if (storedMap.has(sourceId)) {
			const raw = storedMap.get(sourceId);
			// Try to parse as number if it looks numeric
			if (raw !== null && raw !== undefined && raw !== '' && !isNaN(Number(raw))) {
				values[sourceId] = Number(raw);
			} else {
				values[sourceId] = raw ?? null;
			}
		}
	}

	// If all values were found in DB, skip live API calls
	if (missingSourceIds.length === 0) return values;

	// Skip live API calls for future dates (no wearable data will exist)
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const requestDate = new Date(date + 'T00:00:00');
	if (requestDate > today) {
		for (const sourceId of missingSourceIds) {
			values[sourceId] = null;
		}
		return values;
	}

	// Group missing sources by plugin for live fetch
	const sourcesByPlugin = new Map<string, string[]>();
	for (const sourceId of missingSourceIds) {
		const config = parseSource(sourceId);
		if (!config) continue;

		const fields = sourcesByPlugin.get(config.pluginId) || [];
		fields.push(config.fieldId);
		sourcesByPlugin.set(config.pluginId, fields);
	}

	// Fetch missing data from each plugin via live API
	for (const [pluginId, fields] of sourcesByPlugin) {
		const plugin = getPlugin(pluginId);
		if (!plugin) continue;

		const config = await getUserPluginConfig(userId, pluginId);
		if (!config || !config.credentials) continue;

		try {
			const records = await plugin.fetchData(
				config.credentials,
				date,
				date,
				fields
			);

			const record = records.find(r => r.date === date);
			if (record) {
				for (const fieldId of fields) {
					const sourceId = `${pluginId}.${fieldId}`;
					const value = record.fields[fieldId];
					values[sourceId] = value ?? null;

					// Cache the fetched value in the DB for future requests
					const stringValue = value === null || value === undefined ? null : String(value);
					const existing = await db.query.dailyMetricValues.findFirst({
						where: and(
							eq(dailyMetricValues.userId, userId),
							eq(dailyMetricValues.date, date),
							eq(dailyMetricValues.metricName, sourceId)
						)
					});
					if (existing) {
						await db.update(dailyMetricValues)
							.set({ value: stringValue })
							.where(eq(dailyMetricValues.id, existing.id));
					} else {
						await db.insert(dailyMetricValues).values({
							id: uuidv4(),
							userId,
							date,
							metricName: sourceId,
							value: stringValue,
							source: pluginId
						});
					}
				}
			}
		} catch (error) {
			console.error(`Error fetching data from ${pluginId}:`, error);
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
