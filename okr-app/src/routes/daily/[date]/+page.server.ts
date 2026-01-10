import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { MetricDefinition } from '$lib/db/schema';
import { db } from '$lib/db/client';
import { timePeriods, tasks, taskAttributes, taskTags } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getWeekNumber, getWeekYear } from '$lib/utils/week';

export const load: PageServerLoad = async ({ params, locals, fetch, depends }) => {
	// Register dependencies for invalidation
	depends('data:daily');
	depends('data:tasks');
	depends('data:weekly');

	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const dateStr = params.date;

	// Validate date format
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
		throw redirect(302, `/daily/${formatDate(new Date())}`);
	}

	// Calculate week number and year for this date
	const dateObj = new Date(dateStr + 'T00:00:00Z');
	const weekStartDay = locals.user.weekStartDay || 'monday';
	const weekYear = getWeekYear(dateObj, weekStartDay);
	const weekNumber = getWeekNumber(dateObj, weekStartDay);

	// Fetch daily data, flexible metrics, tags, and weekly period in parallel
	const [response, flexResponse, tagsResponse, weeklyPeriod] = await Promise.all([
		fetch(`/api/periods/daily/${dateStr}`),
		fetch(`/api/metrics/flexible/${dateStr}`),
		fetch('/api/tags'),
		db.query.timePeriods.findFirst({
			where: and(
				eq(timePeriods.userId, locals.user.id),
				eq(timePeriods.periodType, 'weekly'),
				eq(timePeriods.year, weekYear),
				eq(timePeriods.week, weekNumber)
			)
		})
	]);

	const data = await response.json();

	if (!response.ok) {
		return {
			date: dateStr,
			period: null,
			tasks: [],
			metrics: null,
			flexibleMetrics: null,
			weeklyInitiatives: [],
			weeklyPeriod: null,
			weekYear,
			weekNumber,
			error: data.error || 'Failed to load data'
		};
	}

	const flexData = await flexResponse.json();
	const tagsData = await tagsResponse.json();

	// Load weekly initiatives if we have a weekly period
	let weeklyInitiatives: any[] = [];
	if (weeklyPeriod) {
		const weeklyTasks = await db.query.tasks.findMany({
			where: eq(tasks.timePeriodId, weeklyPeriod.id),
			orderBy: (task, { asc }) => [asc(task.sortOrder)]
		});

		weeklyInitiatives = await Promise.all(
			weeklyTasks.map(async (task) => {
				const attributes = await db.query.taskAttributes.findMany({
					where: eq(taskAttributes.taskId, task.id)
				});

				const tags = await db.query.taskTags.findMany({
					where: eq(taskTags.taskId, task.id)
				});

				return {
					...task,
					attributes: attributes.reduce(
						(acc, attr) => {
							acc[attr.key] = attr.value;
							return acc;
						},
						{} as Record<string, string>
					),
					tagIds: tags.map((t) => t.tagId)
				};
			})
		);
	}

	return {
		date: dateStr,
		period: data.period,
		tasks: data.tasks || [],
		metrics: data.metrics,
		tags: tagsData.tags || [],
		// Flexible metrics system
		flexibleMetrics: flexResponse.ok ? {
			template: flexData.template as { id: string; name: string; effectiveFrom: string } | null,
			metricsDefinition: (flexData.metrics || []) as MetricDefinition[],
			values: (flexData.values || {}) as Record<string, string | number | boolean | null>,
			errors: (flexData.errors || {}) as Record<string, string>
		} : null,
		// Weekly initiatives
		weeklyInitiatives,
		weeklyPeriod,
		weekYear,
		weekNumber
	};
};

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
