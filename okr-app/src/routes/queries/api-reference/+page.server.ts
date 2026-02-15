import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import apiReferenceMarkdown from '../../../../docs/QUERY_API_REFERENCE.md?raw';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	return {
		markdownContent: apiReferenceMarkdown
	};
};
