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
import { getPlugin } from '$lib/server/plugins/manager';

export type AiChatContext = 'query' | 'kr_progress' | 'widget' | 'metric';

export const CONTEXT_ADDENDA: Record<AiChatContext, string> = {
	query: '',
	kr_progress: `
## Context: Key Result Progress Code

The user is writing code for a Key Result progress calculation. This code runs automatically to compute a KR's score.

**IMPORTANT RULES:**
- You MUST call \`progress.set(numerator, denominator)\` to set the KR score (e.g., \`progress.set(7, 10)\`)
- The score is computed as numerator/denominator (clamped 0–1), and "7 / 10" is shown as the label
- Do NOT use \`render.markdown()\`, \`render.table()\`, or \`render.plot.*()\` — rendered output is not displayed in this context
- The code should fetch real data to compute a meaningful score
- Always handle the empty-data case: if no data is found, call \`progress.set(0, 1)\`
`,
	widget: `
## Context: Dashboard Widget Code

The user is writing code for a dashboard widget. The rendered output is displayed as a card on the dashboard.

**IMPORTANT RULES:**
- Use \`render.markdown()\`, \`render.table()\`, and \`render.plot.*()\` to display output
- Do NOT use \`progress.set()\` — it has no effect in widget context
- Keep output concise — widgets have limited display space
- Prefer a single chart or a short summary over verbose output
`,
	metric: `
## Context: Computed Metric Expression

The user is writing a JavaScript expression for a computed metric in their daily metrics template. This expression runs automatically each day to calculate a derived value from other metrics.

**IMPORTANT RULES:**
- This is a single JavaScript EXPRESSION, not a function body — it must evaluate to a value
- Access other metrics via \`metrics.metricName\` (e.g., \`metrics.sleep_duration\`, \`metrics.steps\`)
- Only metrics defined ABOVE this one in the template are available
- The expression should return a number, string, or boolean
- Keep it simple — this runs on every daily metric evaluation
- The \`date\` variable is available as a YYYY-MM-DD string

**Available helpers on the \`q\` object:**
- \`q.parseTime(timeStr)\` — converts "HH:MM" string to minutes (number)
- \`q.formatDuration(minutes)\` — converts minutes to "HH:MM" string
- \`q.formatTime(minutes)\` — converts minutes to "HH:MM" string
- \`q.isWeekday(dateStr)\` — returns true if the date is Mon-Fri
- \`q.round(value, decimals)\` — rounds a number to N decimal places

**Examples:**
- Sleep quality score: \`metrics.sleep_duration >= 7 ? "Good" : "Poor"\`
- Active minutes ratio: \`q.round(metrics.active_zone_minutes / 30 * 100, 1)\`
- Sleep in minutes: \`q.parseTime(metrics.sleep_length)\`
- Formatted sleep: \`q.formatDuration(q.parseTime(metrics.sleep_length))\`
- Caffeine warning: \`metrics.caffeine_cups > 3 ? "Too much!" : "OK"\`
`
};

/**
 * Build the full system prompt for a user, including API reference and metrics info.
 */
export async function buildSystemPrompt(userId: string, context: AiChatContext = 'query', contextData?: Record<string, unknown>): Promise<string> {
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

	// Append context-specific instructions
	const addendum = CONTEXT_ADDENDA[context];
	if (addendum) {
		prompt += '\n' + addendum;
	}

	// Append dynamic context data (e.g., available metrics for computed expressions)
	if (context === 'metric' && contextData?.availableMetrics) {
		const metrics = contextData.availableMetrics as MetricDefinition[];
		if (metrics.length > 0) {
			const lines = metrics.map(m => {
				const parts = [`\`metrics.${m.name}\` — ${m.label} (${m.type})`];
				if (m.type === 'input' && m.inputType) parts.push(`format: ${m.inputType}${m.unit ? ` (${m.unit})` : ''}`);
				if (m.type === 'computed' && m.expression) parts.push(`expression: \`${m.expression}\``);
				if (m.type === 'external' && m.source) {
					parts.push(describeExternalSource(m.source));
				}
				return `- ${parts.join(', ')}`;
			});
			prompt += `\n## Available Metrics\n\nThe following metrics are defined above this one and can be referenced in the expression:\n\n${lines.join('\n')}\n`;
		} else {
			prompt += `\n## Available Metrics\n\nNo metrics are defined above this one. This is the first metric in the template, so \`metrics.*\` will be empty.\n`;
		}
	}

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
		if (d.type === 'computed' && d.expression) {
			parts.push(`expression: \`${d.expression}\``);
		}
		if (d.type === 'external' && d.source) {
			parts.push(describeExternalSource(d.source));
		}
		return `- ${parts.join(', ')}`;
	});

	return `## User's Available Metrics

The user's current metrics template defines these metrics (accessible via \`day.metrics.{name}\`):

${lines.join('\n')}

Use these exact metric names when accessing \`day.metrics\` in generated code. For time-format metrics (inputType: "time"), use \`q.parseTime()\` to convert to minutes.`;
}

/**
 * Describe an external source string (e.g. "fitbit.sleepLength") with format info from the plugin.
 */
function describeExternalSource(source: string): string {
	let desc = `source: ${source}`;
	const dotIdx = source.indexOf('.');
	if (dotIdx > 0) {
		const pluginId = source.substring(0, dotIdx);
		const fieldId = source.substring(dotIdx + 1);
		const plugin = getPlugin(pluginId);
		if (plugin) {
			const field = plugin.getAvailableFields().find(f => f.id === fieldId);
			if (field) {
				desc += ` (${field.type}`;
				if (field.unit) desc += `, ${field.unit}`;
				desc += ')';
			}
		}
	}
	return desc;
}

/**
 * Get the raw default prompt (for display in settings).
 */
export function getDefaultPrompt(): string {
	return defaultPromptMd;
}
