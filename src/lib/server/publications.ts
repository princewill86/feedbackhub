import { error } from '@sveltejs/kit';

export function publicationKind(value: string) {
  if (value !== 'roadmap' && value !== 'changelog') error(404, 'Publication page not found.');
  return value;
}
