<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->dropColumn([
                'paymongo_checkout_id',
                'paymongo_payment_id',
                'paymongo_status',
                'checkout_url',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->string('paymongo_checkout_id')->nullable();
            $table->string('paymongo_payment_id')->nullable();
            $table->string('paymongo_status')->nullable();
            $table->text('checkout_url')->nullable();
        });
    }
};
