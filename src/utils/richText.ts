const legacyTags: Array<[RegExp, string]> = [
  [/<strong>(.*?)<\/strong>/gis, '**$1**'],
  [/<b>(.*?)<\/b>/gis, '**$1**'],
  [/<em>(.*?)<\/em>/gis, '*$1*'],
  [/<i>(.*?)<\/i>/gis, '*$1*'],
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeLegacyHtml(value: string): string {
  return legacyTags.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function richText(value = ''): string {
  let html = escapeHtml(normalizeLegacyHtml(value.trim()));

  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );

  return html.replace(/\n/g, '<br />');
}
