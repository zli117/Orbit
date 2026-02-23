import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, sqlite } from '$lib/db/client';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
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

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BackupDataV2 {
	version: number;
	exportedAt: string;
	preferences?: {
		timezone?: string;
		weekStartDay?: 'sunday' | 'monday';
		bgColor?: string | null;
	};
	data: {
		values?: any[];
		orphanPrinciples?: any[];
		tags?: any[];
		savedQueries?: any[];
		objectives?: any[];
		timePeriods?: any[];
		dashboardWidgets?: any[];
		metricsTemplates?: any[];
		dailyMetricValues?: any[];
		objectiveReflections?: any[];
	};
}

// Convert ISO timestamp strings back to Date objects
function toDate(val: unknown): Date | null {
	if (!val) return null;
	if (val instanceof Date) return val;
	if (typeof val === 'string') return new Date(val);
	if (typeof val === 'number') return new Date(val);
	return null;
}

function toDateRequired(val: unknown): Date {
	return toDate(val) || new Date();
}

// POST /api/backup/restore - Restore from backup (wipes and replaces all user data)
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const backup: BackupDataV2 = await request.json();

		// Validate backup format
		if (!backup.version || !backup.data) {
			return json({ error: 'Invalid backup format' }, { status: 400 });
		}

		if (backup.version !== 2) {
			return json(
				{ error: `Unsupported backup version: ${backup.version}. Only version 2 is supported.` },
				{ status: 400 }
			);
		}

		// Use a transaction for atomic restore
		const result = sqlite.transaction(() => {
			const stats: Record<string, number> = {};

			// ========================================
			// STEP 1: Delete all existing user data
			// (child tables first, then parent tables)
			// ========================================
			// Child tables that reference tasks
			db.delete(taskAttributes)
				.where(
					eq(
						taskAttributes.taskId,
						db
							.select({ id: tasks.id })
							.from(tasks)
							.where(eq(tasks.userId, userId))
							.limit(1) as any
					)
				)
				.run();
			// Use raw SQL for bulk child deletes to avoid subquery issues
			sqlite
				.prepare(
					`DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE user_id = ?)`
				)
				.run(userId);
			sqlite
				.prepare(
					`DELETE FROM task_attributes WHERE task_id IN (SELECT id FROM tasks WHERE user_id = ?)`
				)
				.run(userId);
			sqlite
				.prepare(
					`DELETE FROM key_results WHERE objective_id IN (SELECT id FROM objectives WHERE user_id = ?)`
				)
				.run(userId);
			sqlite
				.prepare(
					`DELETE FROM daily_metrics WHERE user_id = ?`
				)
				.run(userId);
			sqlite
				.prepare(
					`DELETE FROM time_commitments WHERE time_period_id IN (SELECT id FROM time_periods WHERE user_id = ?)`
				)
				.run(userId);

			// Parent tables with userId
			db.delete(tasks).where(eq(tasks.userId, userId)).run();
			db.delete(timePeriods).where(eq(timePeriods.userId, userId)).run();
			db.delete(objectives).where(eq(objectives.userId, userId)).run();
			db.delete(principles).where(eq(principles.userId, userId)).run();
			db.delete(values).where(eq(values.userId, userId)).run();
			db.delete(tags).where(eq(tags.userId, userId)).run();
			db.delete(savedQueries).where(eq(savedQueries.userId, userId)).run();
			db.delete(dashboardWidgets).where(eq(dashboardWidgets.userId, userId)).run();
			db.delete(metricsTemplates).where(eq(metricsTemplates.userId, userId)).run();
			db.delete(dailyMetricValues).where(eq(dailyMetricValues.userId, userId)).run();
			db.delete(objectiveReflections).where(eq(objectiveReflections.userId, userId)).run();

			// ========================================
			// STEP 2: Insert from backup with new IDs
			// ========================================

			// --- Tags ---
			const tagNameToId = new Map<string, string>();
			if (backup.data.tags) {
				for (const t of backup.data.tags) {
					const id = uuidv4();
					tagNameToId.set(t.name, id);
					db.insert(tags)
						.values({
							id,
							userId,
							name: t.name,
							color: t.color ?? null,
							category: t.category ?? null
						})
						.run();
				}
				stats.tags = backup.data.tags.length;
			}

			// --- Values with nested principles ---
			if (backup.data.values) {
				let principleCount = 0;
				for (const v of backup.data.values) {
					const valueId = uuidv4();
					db.insert(values)
						.values({
							id: valueId,
							userId,
							title: v.title,
							rank: v.rank ?? 0,
							description: v.description ?? null,
							createdAt: toDateRequired(v.createdAt),
							updatedAt: toDateRequired(v.updatedAt)
						})
						.run();

					// Nested principles
					if (v.principles && Array.isArray(v.principles)) {
						for (const p of v.principles) {
							db.insert(principles)
								.values({
									id: uuidv4(),
									userId,
									valueId,
									title: p.title,
									description: p.description ?? null,
									examples: p.examples ?? null,
									createdAt: toDateRequired(p.createdAt),
									updatedAt: toDateRequired(p.updatedAt)
								})
								.run();
							principleCount++;
						}
					}
				}
				stats.values = backup.data.values.length;
				stats.principles = principleCount;
			}

			// Orphan principles (not linked to a value)
			if (backup.data.orphanPrinciples) {
				for (const p of backup.data.orphanPrinciples) {
					db.insert(principles)
						.values({
							id: uuidv4(),
							userId,
							valueId: null,
							title: p.title,
							description: p.description ?? null,
							examples: p.examples ?? null,
							createdAt: toDateRequired(p.createdAt),
							updatedAt: toDateRequired(p.updatedAt)
						})
						.run();
					stats.principles = (stats.principles ?? 0) + 1;
				}
			}

			// --- Saved queries ---
			const queryNameToId = new Map<string, string>();
			if (backup.data.savedQueries) {
				for (const q of backup.data.savedQueries) {
					const id = uuidv4();
					queryNameToId.set(q.name, id);
					db.insert(savedQueries)
						.values({
							id,
							userId,
							name: q.name,
							description: q.description ?? null,
							queryType: q.queryType ?? 'general',
							code: q.code ?? '',
							createdAt: toDateRequired(q.createdAt),
							updatedAt: toDateRequired(q.updatedAt)
						})
						.run();
				}
				stats.savedQueries = backup.data.savedQueries.length;
			}

			// --- Objectives with nested key results ---
			const objectiveNewIds: string[] = [];
			if (backup.data.objectives) {
				let krCount = 0;

				// First pass: create all objectives (parentIndex resolved in second pass)
				for (const o of backup.data.objectives) {
					const id = uuidv4();
					objectiveNewIds.push(id);
					db.insert(objectives)
						.values({
							id,
							userId,
							title: o.title,
							description: o.description ?? null,
							level: o.level ?? 'yearly',
							year: o.year ?? new Date().getFullYear(),
							month: o.month ?? null,
							weight: o.weight ?? 1.0,
							category: o.category ?? null,
							colorIndex: o.colorIndex ?? null,
							parentId: null, // set in second pass
							createdAt: toDateRequired(o.createdAt),
							updatedAt: toDateRequired(o.updatedAt)
						})
						.run();

					// Nested key results
					if (o.keyResults && Array.isArray(o.keyResults)) {
						for (const kr of o.keyResults) {
							db.insert(keyResults)
								.values({
									id: uuidv4(),
									objectiveId: id,
									title: kr.title,
									details: kr.details ?? null,
									weight: kr.weight ?? 1.0,
									score: kr.score ?? 0,
									expectedHours: kr.expectedHours ?? 0,
									sortOrder: kr.sortOrder ?? 0,
									measurementType: kr.measurementType ?? 'slider',
									checkboxItems: kr.checkboxItems ?? null,
									progressQueryId: kr.progressQueryName
										? (queryNameToId.get(kr.progressQueryName) ?? null)
										: null,
									progressQueryCode: kr.progressQueryCode ?? null,
									widgetQueryId: kr.widgetQueryName
										? (queryNameToId.get(kr.widgetQueryName) ?? null)
										: null,
									widgetQueryCode: kr.widgetQueryCode ?? null,
									createdAt: toDateRequired(kr.createdAt),
									updatedAt: toDateRequired(kr.updatedAt)
								})
								.run();
							krCount++;
						}
					}
				}

				// Second pass: resolve parentIndex → parentId
				for (let i = 0; i < backup.data.objectives.length; i++) {
					const o = backup.data.objectives[i];
					if (o.parentIndex !== null && o.parentIndex !== undefined) {
						const parentId = objectiveNewIds[o.parentIndex];
						if (parentId) {
							db.update(objectives)
								.set({ parentId })
								.where(eq(objectives.id, objectiveNewIds[i]))
								.run();
						}
					}
				}

				stats.objectives = backup.data.objectives.length;
				stats.keyResults = krCount;
			}

			// --- Time periods with nested tasks, dailyMetrics, timeCommitments ---
			if (backup.data.timePeriods) {
				let taskCount = 0;
				let taskAttrCount = 0;
				let taskTagCount = 0;
				let metricsCount = 0;
				let commitmentCount = 0;

				for (const tp of backup.data.timePeriods) {
					const tpId = uuidv4();
					db.insert(timePeriods)
						.values({
							id: tpId,
							userId,
							periodType: tp.periodType,
							year: tp.year,
							month: tp.month ?? null,
							week: tp.week ?? null,
							day: tp.day ?? null,
							notes: tp.notes ?? null,
							reviewWhatWorked: tp.reviewWhatWorked ?? null,
							reviewImprovements: tp.reviewImprovements ?? null,
							createdAt: toDateRequired(tp.createdAt),
							updatedAt: toDateRequired(tp.updatedAt)
						})
						.run();

					// Time commitment
					if (tp.timeCommitment) {
						db.insert(timeCommitments)
							.values({
								timePeriodId: tpId,
								numberOfWeeks: tp.timeCommitment.numberOfWeeks ?? 4,
								availableHoursPerWeekday: tp.timeCommitment.availableHoursPerWeekday ?? 1.5,
								availableHoursPerWeekend: tp.timeCommitment.availableHoursPerWeekend ?? 8.0
							})
							.run();
						commitmentCount++;
					}

					// Daily metrics
					if (tp.dailyMetrics) {
						const m = tp.dailyMetrics;
						db.insert(dailyMetrics)
							.values({
								id: uuidv4(),
								userId,
								timePeriodId: tpId,
								previousNightBedTime: m.previousNightBedTime ?? null,
								wakeUpTime: m.wakeUpTime ?? null,
								sleepLength: m.sleepLength ?? null,
								cardioLoad: m.cardioLoad ?? null,
								fitbitReadiness: m.fitbitReadiness ?? null,
								steps: m.steps ?? null,
								heartPoints: m.heartPoints ?? null,
								restingHeartRate: m.restingHeartRate ?? null,
								customMetrics: m.customMetrics ?? null
							})
							.run();
						metricsCount++;
					}

					// Tasks with nested attributes and tag names
					if (tp.tasks && Array.isArray(tp.tasks)) {
						for (const t of tp.tasks) {
							const taskId = uuidv4();
							db.insert(tasks)
								.values({
									id: taskId,
									userId,
									timePeriodId: tpId,
									title: t.title,
									completed: t.completed ?? false,
									completedAt: toDate(t.completedAt),
									sortOrder: t.sortOrder ?? 0,
									timeSpentMs: t.timeSpentMs ?? 0,
									timerStartedAt: toDate(t.timerStartedAt),
									createdAt: toDateRequired(t.createdAt),
									updatedAt: toDateRequired(t.updatedAt)
								})
								.run();
							taskCount++;

							// Task attributes
							if (t.attributes && Array.isArray(t.attributes)) {
								for (const a of t.attributes) {
									db.insert(taskAttributes)
										.values({
											id: uuidv4(),
											taskId,
											key: a.key,
											value: a.value,
											valueType: a.valueType ?? 'number'
										})
										.run();
									taskAttrCount++;
								}
							}

							// Task tags (by name)
							if (t.tagNames && Array.isArray(t.tagNames)) {
								for (const tagName of t.tagNames) {
									const tagId = tagNameToId.get(tagName);
									if (tagId) {
										db.insert(taskTags).values({ taskId, tagId }).run();
										taskTagCount++;
									}
								}
							}
						}
					}
				}

				stats.timePeriods = backup.data.timePeriods.length;
				stats.tasks = taskCount;
				stats.taskAttributes = taskAttrCount;
				stats.taskTags = taskTagCount;
				stats.dailyMetrics = metricsCount;
				stats.timeCommitments = commitmentCount;
			}

			// --- Dashboard widgets ---
			if (backup.data.dashboardWidgets) {
				for (const w of backup.data.dashboardWidgets) {
					db.insert(dashboardWidgets)
						.values({
							id: uuidv4(),
							userId,
							title: w.title,
							widgetType: w.widgetType ?? 'custom',
							config: w.config ?? '{}',
							sortOrder: w.sortOrder ?? 0,
							page: w.page ?? 'dashboard',
							createdAt: toDateRequired(w.createdAt)
						})
						.run();
				}
				stats.dashboardWidgets = backup.data.dashboardWidgets.length;
			}

			// --- Metrics templates ---
			if (backup.data.metricsTemplates) {
				for (const mt of backup.data.metricsTemplates) {
					db.insert(metricsTemplates)
						.values({
							id: uuidv4(),
							userId,
							name: mt.name ?? 'default',
							effectiveFrom: mt.effectiveFrom,
							metricsDefinition: mt.metricsDefinition,
							createdAt: toDateRequired(mt.createdAt),
							updatedAt: toDateRequired(mt.updatedAt)
						})
						.run();
				}
				stats.metricsTemplates = backup.data.metricsTemplates.length;
			}

			// --- Daily metric values ---
			if (backup.data.dailyMetricValues) {
				for (const mv of backup.data.dailyMetricValues) {
					db.insert(dailyMetricValues)
						.values({
							id: uuidv4(),
							userId,
							date: mv.date,
							metricName: mv.metricName,
							value: mv.value ?? null,
							source: mv.source ?? 'user'
						})
						.run();
				}
				stats.dailyMetricValues = backup.data.dailyMetricValues.length;
			}

			// --- Objective reflections ---
			if (backup.data.objectiveReflections) {
				for (const r of backup.data.objectiveReflections) {
					db.insert(objectiveReflections)
						.values({
							id: uuidv4(),
							userId,
							level: r.level,
							year: r.year,
							month: r.month ?? null,
							reflection: r.reflection ?? '',
							createdAt: toDateRequired(r.createdAt),
							updatedAt: toDateRequired(r.updatedAt)
						})
						.run();
				}
				stats.objectiveReflections = backup.data.objectiveReflections.length;
			}

			// ========================================
			// STEP 3: Restore user preferences
			// ========================================
			if (backup.preferences) {
				const updates: Record<string, unknown> = {};
				if (backup.preferences.timezone) updates.timezone = backup.preferences.timezone;
				if (backup.preferences.weekStartDay)
					updates.weekStartDay = backup.preferences.weekStartDay;
				if (backup.preferences.bgColor !== undefined)
					updates.bgColor = backup.preferences.bgColor;
				if (Object.keys(updates).length > 0) {
					db.update(users).set(updates).where(eq(users.id, userId)).run();
				}
			}

			return stats;
		})();

		return json({
			success: true,
			message: 'Backup restored successfully. All previous data was replaced.',
			stats: result
		});
	} catch (error) {
		console.error('Restore failed:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to restore backup' },
			{ status: 500 }
		);
	}
};
