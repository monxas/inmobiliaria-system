// Client-side hooks for token expiration auto-logout
import { auth } from '$stores/auth';
import { getAccessToken } from '$api/client';
import { browser } from '$app/environment';

if (browser) {
	// Check token expiration every 60 seconds
	setInterval(() => {
		const token = getAccessToken();
		if (!token) return;

		try {
			const payload = JSON.parse(atob(token.split('.')[1]));
			const expiresAt = payload.exp * 1000;
			const now = Date.now();
			const fiveMinutes = 5 * 60 * 1000;

			if (now >= expiresAt) {
				// Token expired - logout
				auth.logout();
				window.location.href = '/auth/login';
			} else if (expiresAt - now < fiveMinutes) {
				// Token expiring soon - try refresh
				auth.initialize();
			}
		} catch {
			// Invalid token
		}
	}, 60_000);
}
