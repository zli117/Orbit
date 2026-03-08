import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ouraPlugin } from '$lib/server/plugins/oura';
import { generateState, buildAuthorizationUrl } from '$lib/server/plugins/oauth';
import { setPendingAuth } from '$lib/server/plugins/oauth-state';

// GET /api/plugins/oura/auth - Start OAuth flow
export const GET: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const config = await ouraPlugin.getOAuthConfig();

	if (!config.clientId) {
		return json({ error: 'Oura not configured. Set client ID and secret in admin settings.' }, { status: 500 });
	}

	const state = generateState();

	// Store pending auth (no PKCE for Oura)
	setPendingAuth(state, {
		userId: locals.user.id,
		codeVerifier: '', // Not used for Oura (no PKCE)
		expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
	});

	const authUrl = buildAuthorizationUrl(config, state);

	// Set state in cookie for verification
	cookies.set('oura_oauth_state', state, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 600 // 10 minutes
	});

	throw redirect(302, authUrl);
};
