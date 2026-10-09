<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Course;
use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditTrailTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('activity_logs', function (Blueprint $table) {
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

        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('acronym')->nullable();
            $table->text('description')->nullable();
            $table->string('program_type')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->boolean('is_active')->nullable();
            $table->string('api_token')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('courses');
        Schema::dropIfExists('activity_logs');

        parent::tearDown();
    }

    public function test_model_changes_are_audited_with_values_and_secrets_redacted(): void
    {
        $course = new Course();
        $course->fill(['name' => 'Computer Science', 'program_type' => 'college']);
        $course->setAttribute('api_token', 'do-not-store-this');
        $course->save();

        $course->forceFill([
            'name' => 'Computer Science and Engineering',
            'api_token' => 'another-secret',
        ])->save();

        $created = ActivityLog::query()->where('action', 'model_created')->firstOrFail();
        $updated = ActivityLog::query()->where('action', 'model_updated')->firstOrFail();

        $this->assertSame('Computer Science', $created->meta['changes']['name']['new']);
        $this->assertSame('[REDACTED]', $created->meta['changes']['api_token']['new']);
        $this->assertSame('Computer Science', $updated->meta['changes']['name']['old']);
        $this->assertSame('Computer Science and Engineering', $updated->meta['changes']['name']['new']);
        $this->assertSame('[REDACTED]', $updated->meta['changes']['api_token']['old']);
        $this->assertSame('[REDACTED]', $updated->meta['changes']['api_token']['new']);

        $course->delete();
        $deleted = ActivityLog::query()->where('action', 'model_deleted')->firstOrFail();
        $this->assertSame('Computer Science and Engineering', $deleted->meta['changes']['name']['old']);
        $this->assertNull($deleted->meta['changes']['name']['new']);
    }

    public function test_authentication_events_are_logged_without_credentials(): void
    {
        $user = (new User())->forceFill([
            'id' => 17,
            'name' => 'Audit User',
            'email' => 'audit@example.com',
            'role' => 'student',
        ]);

        Event::dispatch(new Login('web', $user, false));
        Event::dispatch(new Failed('web', null, [
            'email' => 'audit@example.com',
            'password' => 'must-not-be-logged',
        ]));

        $login = ActivityLog::query()->where('action', 'auth_login')->firstOrFail();
        $failed = ActivityLog::query()->where('action', 'auth_login_failed')->firstOrFail();

        $this->assertSame('Audit User', $login->actor_name);
        $this->assertSame('web', $login->meta['guard']);
        $this->assertSame('audit@example.com', $failed->meta['email']);
        $this->assertArrayNotHasKey('password', $failed->meta);
        $this->assertNull($failed->user_id);
    }

    public function test_relationship_audits_include_pivot_status_changes(): void
    {
        $course = (new Course())->forceFill(['id' => 23, 'name' => 'Computer Science']);

        ActivityLog::recordRelationChange(request(), $course, 'students', [
            17 => ['status' => 'pending'],
        ], [
            17 => ['status' => 'enrolled'],
        ]);

        $log = ActivityLog::query()->where('action', 'relationship_updated')->firstOrFail();

        $this->assertSame(
            [17 => ['status' => 'pending']],
            $log->meta['old']
        );
        $this->assertSame(
            [17 => ['status' => 'enrolled']],
            $log->meta['new']
        );
    }
}
