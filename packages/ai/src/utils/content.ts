export function getMessageContent(m: Record<string, unknown>): string {
  if (typeof m === 'object' && m !== null) {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      const textParts = m.content.filter(
        (p): p is { type: 'text'; text: string } =>
          typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'text' && typeof (p as Record<string, unknown>).text === 'string',
      );
      return textParts.map(p => p.text).join('\n');
    }
    if (typeof m.text === 'string') return m.text;
  }
  return '';
}
