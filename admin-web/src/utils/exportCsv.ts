/**
 * 列表导出 CSV(整改 D2):前端生成下载,带 UTF-8 BOM 兼容 Excel 中文
 */
export interface CsvColumn {
  key: string;
  label: string;
}

function escapeCell(value: unknown): string {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export function exportCsv(filename: string, columns: CsvColumn[], rows: Record<string, unknown>[]): void {
  const lines: string[] = [columns.map((c) => escapeCell(c.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c.key])).join(','));
  }
  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
