import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ouraPlugin } from '$lib/server/plugins/oura';
import { exchangeCodeForTokens } from '$lib/server/plugins/oauth';
import { saveUserPluginConfig } from '$lib/server/plugins/manager';
import { getPendingAuth } from '$lib/server/plugins/oauth-state';

// GET /api/plugins/oura/callback - OAuth callback
export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	// Check for errors
	if (error) {
		console.error('Oura OAuth error:', error);
		throw redirect(302, '/settings/plugins?error=' + encodeURIComponent(error));
	}

	if (!code || !state) {
		throw redirect(302, '/settings/plugins?error=missing_params');
	}

	// Verify state
	const cookieState = cookies.get('oura_oauth_state');
	if (state !== cookieState) {
		throw redirect(302, '/settings/plugins?error=invalid_state');
	}

	// Get and remove pending auth (getPendingAuth auto-deletes)
	const pending = getPendingAuth(state);
	if (!pending || pending.expiresAt < Date.now()) {
		throw redirect(302, '/settings/plugins?error=expired');
	}

	// Verify the callback is from the same user who initiated the OAuth flow
	if (pending.userId !== locals.user.id) {
		throw redirect(302, '/settings/plugins?error=user_mismatch');
	}

	// Clean up cookie
	cookies.delete('oura_oauth_state', { path: '/' });

	try {
		// Exchange code for tokens (no PKCE code verifier for Oura)
		const config = await ouraPlugin.getOAuthConfig();
		const credentials = await exchangeCodeForTokens(config, code);

		// Save credentials
		await saveUserPluginConfig(pending.userId, 'oura', credentials);
	} catch (err) {
		console.error('Oura token exchange failed:', err);
		throw redirect(302, '/settings/plugins?error=token_exchange_failed');
	}

	// Redirect to success (must be outside try/catch since SvelteKit redirect throws)
	throw redirect(302, '/settings/plugins?success=oura');
};
