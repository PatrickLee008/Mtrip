<?php

declare(strict_types=1);

namespace App\Service;

/** Small typed exports: values are text cells, never spreadsheet formulas. */
final class AccountDeletionExport
{
    public static function build(array $rows, string $format): array
    {
        $columns = ['id','user_id','site_id','state','requested_balance','approved_balance','amount','currency',
            'request_reason','approve_reason','rejection_reason','created_at','approved_at','approval_expires_at','closed_at',
            'approved_name','finance_maker_name','finance_checker_name','finance_made_at','finance_checked_at','balance_log_id'];
        $data = [$columns];
        foreach ($rows as $row) $data[] = array_map(static fn ($key) => (string) ($row[$key] ?? ''), $columns);
        if ($format === 'csv') {
            $stream = fopen('php://temp', 'w+');
            fwrite($stream, "\xEF\xBB\xBF");
            foreach ($data as $line) fputcsv($stream, array_map(static fn ($v) => preg_match('/^[\s]*[=+@-]/u', $v) ? "'" . $v : $v, $line));
            rewind($stream); $bytes = stream_get_contents($stream); fclose($stream);
            return ['filename' => 'wallet-forfeiture.csv', 'mime' => 'text/csv;charset=utf-8', 'base64' => base64_encode($bytes)];
        }
        $path = tempnam(sys_get_temp_dir(), 'deletion-export-');
        try {
            $zip = new \ZipArchive();
            if ($zip->open($path, \ZipArchive::OVERWRITE) !== true) throw new \RuntimeException('Cannot create XLSX');
            $zip->addFromString('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
            $zip->addFromString('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
            $zip->addFromString('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Wallet Forfeiture" sheetId="1" r:id="rId1"/></sheets></workbook>');
            $zip->addFromString('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
            $xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
            foreach ($data as $i => $line) {
                $xml .= '<row r="' . ($i + 1) . '">';
                foreach ($line as $value) {
                    $value = preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}\x{10000}-\x{10FFFF}]/u', '', $value) ?? '';
                    $xml .= '<c t="inlineStr"><is><t xml:space="preserve">' . htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</t></is></c>';
                }
                $xml .= '</row>';
            }
            $zip->addFromString('xl/worksheets/sheet1.xml', $xml . '</sheetData></worksheet>');
            $zip->close();
            return ['filename' => 'wallet-forfeiture.xlsx', 'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'base64' => base64_encode(file_get_contents($path))];
        } finally { if (is_file($path)) unlink($path); }
    }
}
