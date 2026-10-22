<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            $table->string('workflow_status', 24)->default('draft')->after('is_active')->index();
            $table->text('workflow_remarks')->nullable()->after('workflow_status');
            $table->foreignId('department_id')->nullable()->after('workflow_remarks')->constrained('departments')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->after('department_id')->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable()->after('reviewed_by');
            $table->timestamp('reviewed_at')->nullable()->after('submitted_at');
        });
    }

    public function down(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropForeign(['created_by']);
            $table->dropForeign(['reviewed_by']);
            $table->dropColumn(['workflow_status', 'workflow_remarks', 'department_id', 'created_by', 'reviewed_by', 'submitted_at', 'reviewed_at']);
        });
    }
};
