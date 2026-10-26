<?php

namespace Tests\Feature;

use App\Models\AcademicTerm;
use Illuminate\Support\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EnrollmentSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('academic_terms', function (Blueprint $table): void {
            $table->id();
            $table->string('school_year');
            $table->string('semester');
            $table->dateTime('exam_date')->nullable();
            $table->dateTime('grade_finalization_deadline')->nullable();
            $table->dateTime('enrollment_opens_at')->nullable();
            $table->dateTime('enrollment_closes_at')->nullable();
            $table->boolean('is_active')->default(false);
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('academic_terms');

        parent::tearDown();
    }

    public function test_enrollment_settings_prioritize_active_term_over_more_recently_edited_inactive_term(): void
    {
        $activeTermId = DB::table('academic_terms')->insertGetId([
            'school_year' => '2026-2027',
            'semester' => '1st',
            'is_active' => true,
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);

        DB::table('academic_terms')->insert([
            'school_year' => '2027-2028',
            'semester' => '1st',
            'is_active' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/enrollment/settings')
            ->assertOk()
            ->assertJsonPath('term.id', $activeTermId)
            ->assertJsonPath('enrollment_open', true);
    }

    public function test_enrollment_window_uses_the_configured_local_timezone(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-26 07:00:00', 'UTC'));

        try {
            $term = new AcademicTerm([
                'school_year' => '2026-2027',
                'semester' => '1st',
                'enrollment_opens_at' => '2026-10-26 14:00:00',
                'enrollment_closes_at' => '2026-10-27 14:00:00',
                'is_active' => true,
            ]);

            $this->assertTrue($term->isEnrollmentOpen());

            Carbon::setTestNow(Carbon::parse('2026-10-27 06:00:01', 'UTC'));

            $this->assertFalse($term->isEnrollmentOpen());
        } finally {
            Carbon::setTestNow();
        }
    }
}
