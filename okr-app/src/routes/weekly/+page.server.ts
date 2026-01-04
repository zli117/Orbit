import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getWeekNumber, getWeekYear } from '$lib/utils/week';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const today = new Date();
	const weekStartDay = locals.user.weekStartDay || 'monday';
	const year = getWeekYear(today, weekStartDay);
	const week = getWeekNumber(today, weekStartDay);

	throw redirect(302, `/weekly/${year}/${week}`);
};
