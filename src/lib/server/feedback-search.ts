export function containsPattern(query: string) {
  return '%' + query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_') + '%';
}
