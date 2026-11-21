import { error } from '@sveltejs/kit';
import { isLegalDocument, loadLegalDocument } from '$lib/server/legal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  if (!isLegalDocument(params.document)) error(404, 'Page not found.');
  const document = await loadLegalDocument(params.document);
  const blocks = document.body.split(/\r?\n\s*\r?\n/u).map((block) => {
    const head = /^##\s+([^\r\n]+)$/u.exec(block.trim());
    return { heading: Boolean(head), text: head?.[1] ?? block.trim() };
  }).filter((block) => block.text);
  return { kind: params.document, title: document.title, description: document.description, updatedAt: document.updatedAt, blocks };
};
