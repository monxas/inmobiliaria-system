// Client-side hooks for token expiration auto-logout
import { auth } from '$stores/auth-simple';
import { browser } from '$app/environment';

if (browser) {
	// Simple auth doesn't need complex token expiration logic
	// It will auto-authenticate after timeout
	console.log('🔧 Client hooks loaded with auth-simple');
}
