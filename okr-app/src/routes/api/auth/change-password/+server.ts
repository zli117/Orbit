import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, hashPassword } from '$lib/server/auth';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { currentPassword, newPassword } = await request.json();

		if (!currentPassword || !newPassword) {
			return json({ error: 'Current password and new password are required' }, { status: 400 });
		}

		if (newPassword.length < 8) {
			return json({ error: 'New password must be at least 8 characters' }, { status: 400 });
		}

		// Get the user's current password hash
		const user = await db.query.users.findFirst({
			where: eq(users.id, locals.user.id)
		});

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Verify current password
		const valid = await verifyPassword(currentPassword, user.passwordHash);
		if (!valid) {
			return json({ error: 'Current password is incorrect' }, { status: 403 });
		}

		// Hash and save new password
		const newHash = await hashPassword(newPassword);
		await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, locals.user.id));

		return json({ success: true });
	} catch (error) {
		console.error('Error changing password:', error);
		return json({ error: 'Failed to change password' }, { status: 500 });
	}
};
