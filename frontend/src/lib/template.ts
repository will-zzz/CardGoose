/** Replace `{{ColumnName}}` placeholders with row values (design doc variable templating). */
export function applyTemplate(template: string, row: Record<string, string>): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => {
    const k = String(key).trim();
    return row[k] ?? '';
  });
}
