import { mailEnabled } from '$lib/server/mail';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ canRecover: mailEnabled() });
