import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Proxy /api requests to backend
	if (event.url.pathname.startsWith('/api')) {
		const backendUrl = `http://localhost:3000${event.url.pathname}${event.url.search}`;
		
		const headers = new Headers();
		// Forward relevant headers
		const contentType = event.request.headers.get('content-type');
		if (contentType) headers.set('content-type', contentType);
		const authorization = event.request.headers.get('authorization');
		if (authorization) headers.set('authorization', authorization);

		try {
			const response = await fetch(backendUrl, {
				method: event.request.method,
				headers,
				body: event.request.method !== 'GET' && event.request.method !== 'HEAD' 
					? await event.request.text() 
					: undefined
			});

			const responseHeaders = new Headers();
			response.headers.forEach((value, key) => {
				if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
					responseHeaders.set(key, value);
				}
			});

			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: responseHeaders
			});
		} catch (e) {
			return new Response(JSON.stringify({ success: false, error: 'Backend unavailable' }), {
				status: 502,
				headers: { 'content-type': 'application/json' }
			});
		}
	}

	return resolve(event);
};
