import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getWeekNumber, getWeekYear, getTodayDateInTimezone } from '$lib/utils/week';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const timezone = locals.user.timezone || 'UTC';
	const weekStartDay = locals.user.weekStartDay || 'monday';
	const today = getTodayDateInTimezone(timezone);
	const year = getWeekYear(today, weekStartDay);
	const week = getWeekNumber(today, weekStartDay);

	throw redirect(302, `/weekly/${year}/${week}`);
};
