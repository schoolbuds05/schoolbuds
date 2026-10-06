<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->string('refund_status')->nullable()->after('notes');
            $table->text('refund_reason')->nullable()->after('refund_status');
            $table->text('refund_review_notes')->nullable()->after('refund_reason');
            $table->timestamp('refund_requested_at')->nullable()->after('refund_review_notes');
            $table->foreignId('refund_reviewed_by')->nullable()->after('refund_requested_at')->constrained('users')->nullOnDelete();
            $table->timestamp('refund_reviewed_at')->nullable()->after('refund_reviewed_by');
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('refund_reviewed_by');
            $table->dropColumn([
                'refund_status',
                'refund_reason',
                'refund_review_notes',
                'refund_requested_at',
                'refund_reviewed_at',
            ]);
        });
    }
};
