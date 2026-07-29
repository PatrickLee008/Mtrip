/**
 * 前端 CSV 导出:基于当前列表数据生成带 BOM 的 CSV 并触发下载
 * (日志类导出后端只读不落地文件,由前端完成)
 */
export interface ExportColumn {
  title: string;
  key: string;
  format?: (row: Record<string, any>) => string | number;
}

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportCsv(filename: string, columns: ExportColumn[], rows: Record<string, any>[]): void {
  const header = columns.map((col) => escapeCell(col.title)).join(',');
  const body = rows.map((row) =>
    columns.map((col) => escapeCell(col.format ? col.format(row) : row[col.key])).join(','),
  );
  // \ufeff BOM 保证 Excel 打开中文不乱码
  const blob = new Blob(['\ufeff' + [header, ...body].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
