<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->string('semester')->nullable()->after('school_year');
            $table->string('payment_method')->nullable()->after('paid_date');
            $table->string('payment_reference')->nullable()->after('payment_method');
            $table->foreignId('paid_by')->nullable()->after('payment_reference')->constrained('users')->nullOnDelete();
            $table->foreignId('verified_by')->nullable()->after('paid_by')->constrained('users')->nullOnDelete();
            $table->timestamp('payment_verified_at')->nullable()->after('verified_by');
        });
    }

    public function down(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropConstrainedForeignId('paid_by');
            $table->dropConstrainedForeignId('verified_by');
            $table->dropColumn([
                'semester',
                'payment_method',
                'payment_reference',
                'payment_verified_at',
            ]);
        });
    }
};
