const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function replaceVariables(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(TOKEN, (_, key: string) => {
    const v = values[key];
    if (v == null || v === "") return "";
    return String(v);
  });
}

export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(TOKEN)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export function applyLayoutVariables(
  layout: {
    elements: Array<{ text?: string; [k: string]: unknown }>;
    [k: string]: unknown;
  },
  values: Record<string, string | number | null | undefined>,
) {
  return {
    ...layout,
    elements: layout.elements.map((el) =>
      el.text
        ? { ...el, text: replaceVariables(el.text, values) }
        : el,
    ),
  };
}
