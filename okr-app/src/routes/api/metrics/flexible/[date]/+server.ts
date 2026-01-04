import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { metricsTemplates, dailyMetricValues } from '$lib/db/schema';
import type { MetricDefinition } from '$lib/db/schema';
import { eq, and, lte, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { evaluateMetrics, type MetricValues } from '$lib/server/metrics/evaluator';
import { fetchExternalMetrics, getExternalSourceIds } from '$lib/server/metrics/external';

/**
 * Get the active template for a given date
 */
async function getActiveTemplate(userId: string, date: string) {
	// Find template where effectiveFrom <= date, ordered by effectiveFrom desc
	const template = await db.query.metricsTemplates.findFirst({
		where: and(
			eq(metricsTemplates.userId, userId),
			lte(metricsTemplates.effectiveFrom, date)
		),
		orderBy: [desc(metricsTemplates.effectiveFrom)]
	});

	return template;
}

/**
 * Get stored metric values for a date
 */
async function getStoredValues(userId: string, date: string): Promise<MetricValues> {
	const values = await db.query.dailyMetricValues.findMany({
		where: and(
			eq(dailyMetricValues.userId, userId),
			eq(dailyMetricValues.date, date)
		)
	});

	const result: MetricValues = {};
	for (const v of values) {
		result[v.metricName] = v.value;
	}
	return result;
}

// GET /api/metrics/flexible/[date] - Get metrics with template for a date
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const date = params.date;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
	}

	// Get the active template
	const template = await getActiveTemplate(locals.user.id, date);

	if (!template) {
		return json({
			template: null,
			metrics: [],
			values: {},
			computedValues: {},
			errors: {}
		});
	}

	const metricsDefinition: MetricDefinition[] = JSON.parse(template.metricsDefinition);

	// Get stored user input values
	const storedValues = await getStoredValues(locals.user.id, date);

	// Get external source values
	const externalSourceIds = getExternalSourceIds(metricsDefinition);
	const externalValues = externalSourceIds.length > 0
		? await fetchExternalMetrics(locals.user.id, date, externalSourceIds)
		: {};

	// Map external values to metric names
	const mappedExternalValues: MetricValues = {};
	for (const metric of metricsDefinition) {
		if (metric.type === 'external' && metric.source) {
			mappedExternalValues[metric.name] = externalValues[metric.source] ?? null;
		}
	}

	// Evaluate all metrics (inputs, computed, external)
	const { values, errors } = await evaluateMetrics(
		metricsDefinition,
		storedValues,
		mappedExternalValues,
		date
	);

	return json({
		template: {
			id: template.id,
			name: template.name,
			effectiveFrom: template.effectiveFrom
		},
		metrics: metricsDefinition,
		values,
		errors
	});
};

// PUT /api/metrics/flexible/[date] - Save metric values
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const date = params.date;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { values } = body as { values: Record<string, string | number | boolean | null> };

		if (!values || typeof values !== 'object') {
			return json({ error: 'Values object required' }, { status: 400 });
		}

		// Get the active template to validate metric names
		const template = await getActiveTemplate(locals.user.id, date);
		if (!template) {
			return json({ error: 'No active template for this date' }, { status: 400 });
		}

		const metricsDefinition: MetricDefinition[] = JSON.parse(template.metricsDefinition);
		const inputMetricNames = metricsDefinition
			.filter(m => m.type === 'input')
			.map(m => m.name);

		// Only save input-type metrics (not computed or external)
		for (const [metricName, value] of Object.entries(values)) {
			if (!inputMetricNames.includes(metricName)) continue;

			// Check if value already exists
			const existing = await db.query.dailyMetricValues.findFirst({
				where: and(
					eq(dailyMetricValues.userId, locals.user.id),
					eq(dailyMetricValues.date, date),
					eq(dailyMetricValues.metricName, metricName)
				)
			});

			const stringValue = value === null ? null : String(value);

			if (existing) {
				await db.update(dailyMetricValues)
					.set({ value: stringValue })
					.where(eq(dailyMetricValues.id, existing.id));
			} else {
				await db.insert(dailyMetricValues).values({
					id: uuidv4(),
					userId: locals.user.id,
					date,
					metricName,
					value: stringValue,
					source: 'user'
				});
			}
		}

		// Re-evaluate all metrics and return
		const storedValues = await getStoredValues(locals.user.id, date);

		const externalSourceIds = getExternalSourceIds(metricsDefinition);
		const externalValues = externalSourceIds.length > 0
			? await fetchExternalMetrics(locals.user.id, date, externalSourceIds)
			: {};

		const mappedExternalValues: MetricValues = {};
		for (const metric of metricsDefinition) {
			if (metric.type === 'external' && metric.source) {
				mappedExternalValues[metric.name] = externalValues[metric.source] ?? null;
			}
		}

		const { values: evaluatedValues, errors } = await evaluateMetrics(
			metricsDefinition,
			storedValues,
			mappedExternalValues,
			date
		);

		return json({
			success: true,
			values: evaluatedValues,
			errors
		});
	} catch (error) {
		console.error('Error saving metrics:', error);
		return json({ error: 'Failed to save metrics' }, { status: 500 });
	}
};
