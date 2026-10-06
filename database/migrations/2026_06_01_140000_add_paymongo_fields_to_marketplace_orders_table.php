<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->string('paymongo_checkout_id')->nullable()->after('gcash_reference');
            $table->string('paymongo_payment_id')->nullable()->after('paymongo_checkout_id');
            $table->string('paymongo_status')->nullable()->after('paymongo_payment_id');
            $table->text('checkout_url')->nullable()->after('paymongo_status');
            $table->timestamp('paid_at')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->dropColumn([
                'paymongo_checkout_id',
                'paymongo_payment_id',
                'paymongo_status',
                'checkout_url',
                'paid_at',
            ]);
        });
    }
};
