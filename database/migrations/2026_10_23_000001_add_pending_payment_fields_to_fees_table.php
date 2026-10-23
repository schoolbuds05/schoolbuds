<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->decimal('pending_payment_amount', 10, 2)->nullable()->after('paid_amount');
            $table->string('payment_verification_status')->default('none')->after('payment_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('fees', function (Blueprint $table) {
            $table->dropColumn(['pending_payment_amount', 'payment_verification_status']);
        });
    }
};
