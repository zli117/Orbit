import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { users, sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '$lib/server/auth';

// PATCH /api/admin/users/[id] - Update user (disable/enable, toggle admin)
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	const userId = params.id;

	// Cannot modify yourself
	if (userId === locals.user.id) {
		return json({ error: 'Cannot modify your own account' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { isDisabled, isAdmin, resetPassword } = body;

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Handle password reset
		if (resetPassword) {
			const passwordHash = await hashPassword('default1234');
			await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

			// Invalidate all their sessions so they must log in with the new password
			await db.delete(sessions).where(eq(sessions.userId, userId));

			const updatedUser = await db.query.users.findFirst({
				where: eq(users.id, userId)
			});

			return json({
				user: {
					id: updatedUser!.id,
					username: updatedUser!.username,
					isAdmin: updatedUser!.isAdmin || false,
					isDisabled: updatedUser!.isDisabled || false,
					weekStartDay: updatedUser!.weekStartDay,
					timezone: updatedUser!.timezone,
					createdAt: updatedUser!.createdAt
				},
				passwordReset: true
			});
		}

		const updates: { isDisabled?: boolean; isAdmin?: boolean } = {};

		if (typeof isDisabled === 'boolean') {
			updates.isDisabled = isDisabled;
		}

		if (typeof isAdmin === 'boolean') {
			updates.isAdmin = isAdmin;
		}

		if (Object.keys(updates).length === 0) {
			return json({ error: 'No valid updates provided' }, { status: 400 });
		}

		await db.update(users).set(updates).where(eq(users.id, userId));

		// If user was disabled, invalidate all their sessions
		if (updates.isDisabled) {
			await db.delete(sessions).where(eq(sessions.userId, userId));
		}

		const updatedUser = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});

		return json({
			user: {
				id: updatedUser!.id,
				username: updatedUser!.username,
				isAdmin: updatedUser!.isAdmin || false,
				isDisabled: updatedUser!.isDisabled || false,
				weekStartDay: updatedUser!.weekStartDay,
				timezone: updatedUser!.timezone,
				createdAt: updatedUser!.createdAt
			}
		});
	} catch (error) {
		console.error('Error updating user:', error);
		return json({ error: 'Failed to update user' }, { status: 500 });
	}
};

// DELETE /api/admin/users/[id] - Delete user permanently
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	const userId = params.id;

	// Cannot delete yourself
	if (userId === locals.user.id) {
		return json({ error: 'Cannot delete your own account' }, { status: 400 });
	}

	try {
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Delete user - cascades to all related data via schema constraints
		await db.delete(users).where(eq(users.id, userId));

		return json({ success: true, deletedUsername: user.username });
	} catch (error) {
		console.error('Error deleting user:', error);
		return json({ error: 'Failed to delete user' }, { status: 500 });
	}
};
