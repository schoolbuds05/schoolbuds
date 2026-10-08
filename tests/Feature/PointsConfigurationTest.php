<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\SystemControlController;
use App\Models\ActivityLog;
use App\Models\MarketplaceSetting;
use App\Models\User;
use App\Services\PointsConfiguration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PointsConfigurationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('marketplace_settings');
        Schema::create('marketplace_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
        Schema::create('students', function (Blueprint $table): void {
            $table->id();
            $table->string('student_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->string('gender');
            $table->string('grade_level');
            $table->string('section');
            $table->string('school_year')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
        Schema::create('student_rewards', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('student_id');
            $table->unsignedBigInteger('awarded_by_id')->nullable();
            $table->string('source');
            $table->string('source_key');
            $table->string('category');
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('points');
            $table->string('school_year')->nullable();
            $table->string('semester')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
        Schema::create('activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('actor_name')->nullable();
            $table->string('actor_email')->nullable();
            $table->string('actor_role')->nullable();
            $table->string('action');
            $table->string('description');
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('marketplace_settings');
        Schema::dropIfExists('student_rewards');
        Schema::dropIfExists('students');
        Schema::dropIfExists('activity_logs');

        parent::tearDown();
    }

    public function test_points_configuration_reads_saved_values_and_uses_defaults_for_unset_rules(): void
    {
        MarketplaceSetting::create([
            'key' => 'semester_cap',
            'value' => ['value' => 180],
        ]);
        MarketplaceSetting::create([
            'key' => 'redemption_rate',
            'value' => ['value' => '0.75'],
        ]);

        $settings = app(PointsConfiguration::class);

        $this->assertSame(180, $settings->get('semester_cap'));
        $this->assertSame(0.75, $settings->get('redemption_rate'));
        $this->assertSame(200, $settings->get('redemption_cap'));
    }

    public function test_grade_awards_use_the_saved_points_thresholds_and_source_cap(): void
    {
        MarketplaceSetting::create([
            'key' => 'shs_grade_high_threshold',
            'value' => ['value' => 95],
        ]);
        MarketplaceSetting::create([
            'key' => 'grade_cap',
            'value' => ['value' => 7],
        ]);

        $student = \App\Models\Student::create([
            'student_id' => 'STU-2001',
            'first_name' => 'Test',
            'last_name' => 'Learner',
            'email' => 'learner@example.com',
            'gender' => 'female',
            'grade_level' => '1',
            'section' => 'A',
            'school_year' => '2026-2027',
            'user_id' => null,
        ]);

        $reward = app(\App\Services\PointsService::class)->awardGradePoints(
            $student,
            90,
            'grade-test-1',
            schoolYear: '2026-2027',
            semester: '1st'
        );

        $this->assertSame(7, $reward?->points);
    }

    public function test_admin_points_control_saves_rules_and_records_the_change(): void
    {
        $settings = PointsConfiguration::DEFAULTS;
        $settings['semester_cap'] = 180;
        $request = Request::create('/admin/points-configuration', 'POST', $settings);
        $request->setUserResolver(fn () => new User([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'role' => 'admin',
        ]));

        app(SystemControlController::class)->storePoints($request, app(PointsConfiguration::class));

        $this->assertSame(180, app(PointsConfiguration::class)->get('semester_cap'));
        $this->assertSame('points_configuration_updated', ActivityLog::firstOrFail()->action);
        $this->assertSame(180, ActivityLog::firstOrFail()->meta['after']['semester_cap']);
    }
}
