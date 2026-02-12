import { PUBLIC_API_URL } from '$env/static/public';

/**
 * Central API configuration.
 * The URL is read from the PUBLIC_API_URL environment variable.
 * Set it in .env, .env.development, .env.production, or as a system env var.
 */
export const API_BASE = PUBLIC_API_URL;
