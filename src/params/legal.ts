import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (value): value is 'terms' | 'privacy' => value === 'terms' || value === 'privacy';
