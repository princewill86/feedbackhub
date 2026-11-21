import { loadPlatformSettings } from '$lib/server/platform';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ settings: await loadPlatformSettings() });
