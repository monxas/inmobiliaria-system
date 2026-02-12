import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			out: 'build'
		}),
		alias: {
			$components: 'src/lib/components',
			$ui: 'src/lib/components/ui',
			$stores: 'src/lib/stores',
			$api: 'src/lib/api',
			$types: 'src/lib/types'
		}
	}
};

export default config;
