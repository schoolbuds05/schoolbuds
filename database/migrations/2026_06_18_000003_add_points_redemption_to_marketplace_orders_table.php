<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->decimal('original_amount', 10, 2)->default(0)->after('unit_price');
            $table->unsignedInteger('points_redeemed')->default(0)->after('total_amount');
            $table->decimal('points_discount', 10, 2)->default(0)->after('points_redeemed');
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            $table->dropColumn(['original_amount', 'points_redeemed', 'points_discount']);
        });
    }
};
