/**
 * System Prompt Builder
 * Assembles the full system prompt from default template, API reference, and user metrics.
 */

import { db } from '$lib/db/client';
import { userAiConfig, metricsTemplates } from '$lib/db/schema';
import type { MetricDefinition } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import defaultPromptMd from './default-prompt.md?raw';
import apiReferenceMd from '../../../../docs/QUERY_API_REFERENCE.md?raw';

/**
 * Build the full system prompt for a user, including API reference and metrics info.
 */
export async function buildSystemPrompt(userId: string): Promise<string> {
	// Get user's custom prompt or default
	const config = await db.query.userAiConfig.findFirst({
		where: eq(userAiConfig.userId, userId)
	});

	const basePrompt = config?.customSystemPrompt || defaultPromptMd;

	// Build metrics info from user's active template
	const metricsInfo = await buildMetricsInfo(userId);

	// Replace placeholders
	let prompt = basePrompt;
	prompt = prompt.replace('{{API_REFERENCE}}', `## API Reference\n\n${apiReferenceMd}`);
	prompt = prompt.replace('{{USER_METRICS}}', metricsInfo);

	return prompt;
}

/**
 * Build a description of the user's available metrics from their active template.
 */
async function buildMetricsInfo(userId: string): Promise<string> {
	const template = await db.query.metricsTemplates.findFirst({
		where: eq(metricsTemplates.userId, userId),
		orderBy: [desc(metricsTemplates.effectiveFrom)]
	});

	if (!template) {
		return '## User Metrics\n\nNo metrics template configured. The user may not have any daily metrics data.';
	}

	const definitions: MetricDefinition[] = JSON.parse(template.metricsDefinition);

	if (definitions.length === 0) {
		return '## User Metrics\n\nThe user has an empty metrics template.';
	}

	const lines = definitions.map((d) => {
		const parts = [`\`${d.name}\` — ${d.label} (${d.type})`];
		if (d.inputType) parts.push(`input type: ${d.inputType}`);
		if (d.unit) parts.push(`unit: ${d.unit}`);
		if (d.source) parts.push(`source: ${d.source}`);
		return `- ${parts.join(', ')}`;
	});

	return `## User's Available Metrics

The user's current metrics template defines these metrics (accessible via \`day.metrics.{name}\`):

${lines.join('\n')}

Use these exact metric names when accessing \`day.metrics\` in generated code. For time-format metrics (inputType: "time"), use \`q.parseTime()\` to convert to minutes.`;
}

/**
 * Get the raw default prompt (for display in settings).
 */
export function getDefaultPrompt(): string {
	return defaultPromptMd;
}
