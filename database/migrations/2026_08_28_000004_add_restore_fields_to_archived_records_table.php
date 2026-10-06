<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('archived_records', function (Blueprint $table) {
            if (!Schema::hasColumn('archived_records', 'restored_by')) {
                $table->foreignId('restored_by')->nullable()->after('deleted_by')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('archived_records', 'restored_at')) {
                $table->timestamp('restored_at')->nullable()->after('deleted_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('archived_records', function (Blueprint $table) {
            if (Schema::hasColumn('archived_records', 'restored_by')) {
                $table->dropConstrainedForeignId('restored_by');
            }
            if (Schema::hasColumn('archived_records', 'restored_at')) {
                $table->dropColumn('restored_at');
            }
        });
    }
};
