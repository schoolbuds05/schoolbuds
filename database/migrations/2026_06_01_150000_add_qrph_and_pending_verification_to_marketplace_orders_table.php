<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE marketplace_orders MODIFY payment_method ENUM('cash', 'gcash', 'qrph') NOT NULL");
            DB::statement("ALTER TABLE marketplace_orders MODIFY status ENUM('reserved', 'pending_verification', 'paid', 'completed', 'cancelled') NOT NULL DEFAULT 'reserved'");
        } else {
            Schema::table('marketplace_orders', function (Blueprint $table) {
                $table->enum('payment_method', ['cash', 'gcash', 'qrph'])->nullable(false)->change();
                $table->enum('status', ['reserved', 'pending_verification', 'paid', 'completed', 'cancelled'])->default('reserved')->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        DB::statement("UPDATE marketplace_orders SET payment_method = 'gcash' WHERE payment_method = 'qrph'");
        DB::statement("UPDATE marketplace_orders SET status = 'reserved' WHERE status = 'pending_verification'");
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE marketplace_orders MODIFY payment_method ENUM('cash', 'gcash') NOT NULL");
            DB::statement("ALTER TABLE marketplace_orders MODIFY status ENUM('reserved', 'paid', 'completed', 'cancelled') NOT NULL DEFAULT 'reserved'");
        } else {
            Schema::table('marketplace_orders', function (Blueprint $table) {
                $table->enum('payment_method', ['cash', 'gcash'])->nullable(false)->change();
                $table->enum('status', ['reserved', 'paid', 'completed', 'cancelled'])->default('reserved')->nullable(false)->change();
            });
        }
    }
};
