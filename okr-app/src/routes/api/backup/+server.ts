import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import {
	objectives,
	keyResults,
	timePeriods,
	timeCommitments,
	tasks,
	taskAttributes,
	tags,
	taskTags,
	dailyMetrics,
	savedQueries,
	dashboardWidgets,
	values,
	principles,
	objectiveReflections,
	metricsTemplates,
	dailyMetricValues,
	users
} from '$lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

// GET /api/backup - Create a backup of user's data
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		// Fetch user preferences
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});

		// Helper to strip id, userId, and any specified extra fields from records
		const strip = <T extends Record<string, unknown>>(
			records: T[],
			extraFields: string[] = []
		): Record<string, unknown>[] =>
			records.map((record) => {
				const { id: _, userId: __, ...rest } = record;
				const result = { ...rest };
				for (const field of extraFields) {
					delete result[field];
				}
				return result;
			});

		// --- Fetch all data ---

		// Values with nested principles
		const userValues = await db.query.values.findMany({
			where: eq(values.userId, userId)
		});
		const allPrinciples = await db.query.principles.findMany({
			where: eq(principles.userId, userId)
		});
		const valuesExport = userValues.map((v) => ({
			title: v.title,
			rank: v.rank,
			description: v.description,
			createdAt: v.createdAt,
			updatedAt: v.updatedAt,
			principles: allPrinciples
				.filter((p) => p.valueId === v.id)
				.map((p) => ({
					title: p.title,
					description: p.description,
					examples: p.examples,
					createdAt: p.createdAt,
					updatedAt: p.updatedAt
				}))
		}));
		// Also include orphan principles (valueId is null)
		const orphanPrinciples = allPrinciples
			.filter((p) => !p.valueId)
			.map((p) => ({
				title: p.title,
				description: p.description,
				examples: p.examples,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt
			}));

		// Tags (flat, no IDs)
		const userTags = await db.query.tags.findMany({
			where: eq(tags.userId, userId)
		});
		const tagsExport = userTags.map((t) => ({
			name: t.name,
			color: t.color,
			category: t.category
		}));
		// Build tag ID → name map for task tag resolution
		const tagIdToName = new Map(userTags.map((t) => [t.id, t.name]));

		// Saved queries (flat, no IDs)
		const userQueries = await db.query.savedQueries.findMany({
			where: eq(savedQueries.userId, userId)
		});
		const savedQueriesExport = userQueries.map((q) => ({
			name: q.name,
			description: q.description,
			queryType: q.queryType,
			code: q.code,
			createdAt: q.createdAt,
			updatedAt: q.updatedAt
		}));
		// Build query ID → name map for KR references
		const queryIdToName = new Map(userQueries.map((q) => [q.id, q.name]));

		// Objectives with nested key results
		const userObjectives = await db.query.objectives.findMany({
			where: eq(objectives.userId, userId)
		});
		const objectiveIds = userObjectives.map((o) => o.id);
		const allKeyResults =
			objectiveIds.length > 0
				? await db.query.keyResults.findMany({
						where: inArray(keyResults.objectiveId, objectiveIds)
					})
				: [];

		// Build objective ID → index map for parentId resolution
		const objectiveIdToIndex = new Map(userObjectives.map((o, i) => [o.id, i]));

		const objectivesExport = userObjectives.map((o) => ({
			title: o.title,
			description: o.description,
			level: o.level,
			year: o.year,
			month: o.month,
			weight: o.weight,
			category: o.category,
			colorIndex: o.colorIndex,
			parentIndex: o.parentId ? (objectiveIdToIndex.get(o.parentId) ?? null) : null,
			createdAt: o.createdAt,
			updatedAt: o.updatedAt,
			keyResults: allKeyResults
				.filter((kr) => kr.objectiveId === o.id)
				.map((kr) => ({
					title: kr.title,
					details: kr.details,
					weight: kr.weight,
					score: kr.score,
					expectedHours: kr.expectedHours,
					sortOrder: kr.sortOrder,
					measurementType: kr.measurementType,
					checkboxItems: kr.checkboxItems,
					progressQueryName: kr.progressQueryId
						? (queryIdToName.get(kr.progressQueryId) ?? null)
						: null,
					progressQueryCode: kr.progressQueryCode,
					widgetQueryName: kr.widgetQueryId
						? (queryIdToName.get(kr.widgetQueryId) ?? null)
						: null,
					widgetQueryCode: kr.widgetQueryCode,
					createdAt: kr.createdAt,
					updatedAt: kr.updatedAt
				}))
		}));

		// Time periods with nested tasks, dailyMetrics, timeCommitments
		const userTimePeriods = await db.query.timePeriods.findMany({
			where: eq(timePeriods.userId, userId)
		});
		const timePeriodIds = userTimePeriods.map((tp) => tp.id);

		const allTasks =
			timePeriodIds.length > 0
				? await db.query.tasks.findMany({
						where: eq(tasks.userId, userId)
					})
				: [];
		const taskIds = allTasks.map((t) => t.id);

		const allTaskAttrs =
			taskIds.length > 0
				? await db.query.taskAttributes.findMany({
						where: inArray(taskAttributes.taskId, taskIds)
					})
				: [];

		const allTaskTags =
			taskIds.length > 0
				? await db.query.taskTags.findMany({
						where: inArray(taskTags.taskId, taskIds)
					})
				: [];

		const allDailyMetrics =
			timePeriodIds.length > 0
				? await db.query.dailyMetrics.findMany({
						where: eq(dailyMetrics.userId, userId)
					})
				: [];

		const allTimeCommitments =
			timePeriodIds.length > 0
				? await db.query.timeCommitments.findMany({
						where: inArray(timeCommitments.timePeriodId, timePeriodIds)
					})
				: [];

		const timePeriodsExport = userTimePeriods.map((tp) => {
			const tpTasks = allTasks.filter((t) => t.timePeriodId === tp.id);
			const tpMetrics = allDailyMetrics.find((m) => m.timePeriodId === tp.id);
			const tpCommitment = allTimeCommitments.find((c) => c.timePeriodId === tp.id);

			return {
				periodType: tp.periodType,
				year: tp.year,
				month: tp.month,
				week: tp.week,
				day: tp.day,
				notes: tp.notes,
				reviewWhatWorked: tp.reviewWhatWorked,
				reviewImprovements: tp.reviewImprovements,
				createdAt: tp.createdAt,
				updatedAt: tp.updatedAt,
				timeCommitment: tpCommitment
					? {
							numberOfWeeks: tpCommitment.numberOfWeeks,
							availableHoursPerWeekday: tpCommitment.availableHoursPerWeekday,
							availableHoursPerWeekend: tpCommitment.availableHoursPerWeekend
						}
					: null,
				dailyMetrics: tpMetrics
					? {
							previousNightBedTime: tpMetrics.previousNightBedTime,
							wakeUpTime: tpMetrics.wakeUpTime,
							sleepLength: tpMetrics.sleepLength,
							cardioLoad: tpMetrics.cardioLoad,
							fitbitReadiness: tpMetrics.fitbitReadiness,
							steps: tpMetrics.steps,
							heartPoints: tpMetrics.heartPoints,
							restingHeartRate: tpMetrics.restingHeartRate,
							customMetrics: tpMetrics.customMetrics
						}
					: null,
				tasks: tpTasks.map((t) => ({
					title: t.title,
					completed: t.completed,
					completedAt: t.completedAt,
					sortOrder: t.sortOrder,
					timeSpentMs: t.timeSpentMs,
					timerStartedAt: t.timerStartedAt,
					createdAt: t.createdAt,
					updatedAt: t.updatedAt,
					attributes: allTaskAttrs
						.filter((a) => a.taskId === t.id)
						.map((a) => ({
							key: a.key,
							value: a.value,
							valueType: a.valueType
						})),
					tagNames: allTaskTags
						.filter((tt) => tt.taskId === t.id)
						.map((tt) => tagIdToName.get(tt.tagId))
						.filter(Boolean) as string[]
				}))
			};
		});

		// Dashboard widgets (flat, no IDs)
		const userWidgets = await db.query.dashboardWidgets.findMany({
			where: eq(dashboardWidgets.userId, userId)
		});
		const widgetsExport = userWidgets.map((w) => ({
			title: w.title,
			widgetType: w.widgetType,
			config: w.config,
			sortOrder: w.sortOrder,
			page: w.page,
			createdAt: w.createdAt
		}));

		// Remaining flat tables
		const userMetricsTemplates = await db.query.metricsTemplates.findMany({
			where: eq(metricsTemplates.userId, userId)
		});
		const metricsTemplatesExport = strip(userMetricsTemplates);

		const userDailyMetricValues = await db.query.dailyMetricValues.findMany({
			where: eq(dailyMetricValues.userId, userId)
		});
		const dailyMetricValuesExport = strip(userDailyMetricValues);

		const userReflections = await db.query.objectiveReflections.findMany({
			where: eq(objectiveReflections.userId, userId)
		});
		const reflectionsExport = strip(userReflections);

		const backup = {
			version: 2,
			exportedAt: new Date().toISOString(),
			preferences: {
				timezone: user?.timezone ?? 'UTC',
				weekStartDay: user?.weekStartDay ?? 'monday',
				bgColor: user?.bgColor ?? null
			},
			data: {
				values: valuesExport,
				orphanPrinciples,
				tags: tagsExport,
				savedQueries: savedQueriesExport,
				objectives: objectivesExport,
				timePeriods: timePeriodsExport,
				dashboardWidgets: widgetsExport,
				metricsTemplates: metricsTemplatesExport,
				dailyMetricValues: dailyMetricValuesExport,
				objectiveReflections: reflectionsExport
			}
		};

		// Return as downloadable JSON file
		const filename = `okr-backup-${new Date().toISOString().split('T')[0]}.json`;

		return new Response(JSON.stringify(backup, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('Backup failed:', error);
		return json({ error: 'Failed to create backup' }, { status: 500 });
	}
};
