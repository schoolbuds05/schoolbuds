<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\AssignmentController;
use Tests\TestCase;

class PdfQuizModuleTextExtractionTest extends TestCase
{
    public function test_text_based_pdf_content_is_extracted_for_ai_quiz_generation(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'schoolbuds-pdf-');
        $this->assertNotFalse($path);

        try {
            file_put_contents($path, $this->makePdf('Photosynthesis converts light energy into chemical energy.'));

            $extractor = new \ReflectionMethod(AssignmentController::class, 'extractModuleText');
            $text = $extractor->invoke(new AssignmentController(), $path, 'pdf');

            $this->assertStringContainsString('Photosynthesis converts light energy into chemical energy.', $text);
        } finally {
            if (is_string($path) && file_exists($path)) {
                unlink($path);
            }
        }
    }

    private function makePdf(string $text): string
    {
        $stream = "BT /F1 12 Tf 20 100 Td ({$text}) Tj ET";
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            "<< /Length ".strlen($stream)." >>\nstream\n{$stream}\nendstream",
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [0];

        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n{$object}\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n";
        $pdf .= "0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf
            ."trailer\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\n"
            ."startxref\n{$xrefOffset}\n%%EOF";
    }
}
