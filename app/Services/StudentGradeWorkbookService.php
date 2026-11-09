<?php

namespace App\Services;

use RuntimeException;
use ZipArchive;

class StudentGradeWorkbookService
{
    public function createTemplate(array $studentHeaders, array $gradeHeaders, array $studentRows = [], array $gradeRows = []): string
    {
        $path = tempnam(sys_get_temp_dir(), 'schoolbud-workbook-');
        if ($path === false) {
            throw new RuntimeException('Could not create the workbook template.');
        }

        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::OVERWRITE) !== true) {
            @unlink($path);
            throw new RuntimeException('Could not open the workbook template.');
        }

        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Students" sheetId="1" r:id="rId1"/><sheet name="Grades" sheetId="2" r:id="rId2"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>');
        $zip->addFromString('xl/worksheets/sheet1.xml', $this->worksheetXml($studentHeaders, $studentRows));
        $zip->addFromString('xl/worksheets/sheet2.xml', $this->worksheetXml($gradeHeaders, $gradeRows));
        $zip->close();

        return $path;
    }

    public function readSheets(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new RuntimeException('The workbook could not be opened.');
        }

        try {
            $workbook = simplexml_load_string($zip->getFromName('xl/workbook.xml') ?: '');
            $relationships = simplexml_load_string($zip->getFromName('xl/_rels/workbook.xml.rels') ?: '');
            if (!$workbook || !$relationships) {
                throw new RuntimeException('The file is not a valid Excel workbook.');
            }
            $relNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
            $packageNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
            $mainNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
            $targets = [];
            foreach ($relationships->children($packageNs)->Relationship as $relationship) {
                $attrs = $relationship->attributes();
                $targets[(string) $attrs['Id']] = (string) $attrs['Target'];
            }
            $sharedStrings = [];
            if (($xml = $zip->getFromName('xl/sharedStrings.xml')) !== false) {
                $strings = simplexml_load_string($xml);
                foreach ($strings->children($mainNs)->si as $item) {
                    $item->registerXPathNamespace('m', $mainNs);
                    $sharedStrings[] = implode('', $item->xpath('.//m:t') ?: []);
                }
            }

            $sheets = [];
            foreach ($workbook->children($mainNs)->sheets->children($mainNs)->sheet as $sheet) {
                $attrs = $sheet->attributes($relNs);
                $target = $targets[(string) $attrs['id']] ?? null;
                if (!$target) continue;
                $entry = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/' . $target;
                $sheetXml = simplexml_load_string($zip->getFromName($entry) ?: '');
                if (!$sheetXml) continue;
                $grid = [];
                foreach ($sheetXml->children($mainNs)->sheetData->children($mainNs)->row as $row) {
                    $values = [];
                    foreach ($row->children($mainNs)->c as $cell) {
                        $cellAttrs = $cell->attributes();
                        preg_match('/^([A-Z]+)/', (string) $cellAttrs['r'], $match);
                        if (!$match) continue;
                        $column = 0;
                        foreach (str_split($match[1]) as $letter) $column = $column * 26 + ord($letter) - 64;
                        $cellParts = $cell->children($mainNs);
                        $value = (string) ($cellParts->v ?? '');
                        if ((string) $cellAttrs['t'] === 's') $value = $sharedStrings[(int) $value] ?? '';
                        elseif ((string) $cellAttrs['t'] === 'inlineStr') {
                            $cellParts->is->registerXPathNamespace('m', $mainNs);
                            $value = implode('', $cellParts->is->xpath('.//m:t') ?: []);
                        }
                        $values[$column - 1] = $value;
                    }
                    if (array_filter($values, fn ($value) => $value !== '')) {
                        ksort($values);
                        $grid[] = array_map(fn ($column) => $values[$column] ?? '', range(0, max(array_keys($values))));
                    }
                }
                $sheets[(string) $sheet['name']] = $grid;
            }

            if (!isset($sheets['Students'], $sheets['Grades'])) {
                throw new RuntimeException('Workbook must contain tabs named Students and Grades.');
            }
            return $sheets;
        } finally {
            $zip->close();
        }
    }

    private function worksheetXml(array $headers, array $rows = []): string
    {
        $xmlRows = [];
        foreach ([$headers, ...$rows] as $rowIndex => $row) {
            $cells = [];
            foreach (array_values($row) as $index => $value) {
            $column = $index + 1;
            $reference = '';
            while ($column > 0) {
                $remainder = ($column - 1) % 26;
                $reference = chr(65 + $remainder) . $reference;
                $column = intdiv($column - 1, 26);
            }
                $value = htmlspecialchars((string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
                $cells[] = '<c r="' . $reference . ($rowIndex + 1) . '" t="inlineStr"><is><t>' . $value . '</t></is></c>';
            }
            $xmlRows[] = '<row r="' . ($rowIndex + 1) . '">' . implode('', $cells) . '</row>';
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' . implode('', $xmlRows) . '</sheetData></worksheet>';
    }
}
