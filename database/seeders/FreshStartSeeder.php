<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FreshStartSeeder extends Seeder
{
    /**
     * Clear application data and rebuild the basic demo accounts/reference data.
     *
     * Run with:
     * php artisan db:seed --class=FreshStartSeeder
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        foreach ($this->tablesToClear() as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->truncate();
            }
        }

        Schema::enableForeignKeyConstraints();

        Artisan::call('permission:cache-reset');

        $this->call(SchoolSeeder::class);
    }

    private function tablesToClear(): array
    {
        return [
            'activity_logs',
            'assignment_submissions',
            'attendances',
            'cache',
            'cache_locks',
            'class_assignments',
            'event_participations',
            'failed_jobs',
            'fees',
            'grades',
            'job_batches',
            'jobs',
            'marketplace_messages',
            'marketplace_orders',
            'marketplace_items',
            'marketplace_settings',
            'notification_preferences',
            'password_resets',
            'password_reset_tokens',
            'personal_access_tokens',
            'property_assets',
            'school_classes',
            'school_notifications',
            'section_students',
            'section_subjects',
            'sections',
            'student_rewards',
            'student_subjects',
            'subject_prerequisite',
            'subjects',
            'enrollment_applications',
            'students',
            'academic_terms',
            'courses',
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
            'permissions',
            'roles',
            'sessions',
            'users',
        ];
    }
}
