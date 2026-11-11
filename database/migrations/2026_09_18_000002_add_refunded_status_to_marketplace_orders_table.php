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
            DB::statement("ALTER TABLE marketplace_orders MODIFY status ENUM('reserved', 'pending_verification', 'paid', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'reserved'");
        } else {
            Schema::table('marketplace_orders', function (Blueprint $table) {
                $table->enum('status', ['reserved', 'pending_verification', 'paid', 'completed', 'cancelled', 'refunded'])->default('reserved')->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        DB::statement("UPDATE marketplace_orders SET status = 'cancelled' WHERE status = 'refunded'");
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE marketplace_orders MODIFY status ENUM('reserved', 'pending_verification', 'paid', 'completed', 'cancelled') NOT NULL DEFAULT 'reserved'");
        } else {
            Schema::table('marketplace_orders', function (Blueprint $table) {
                $table->enum('status', ['reserved', 'pending_verification', 'paid', 'completed', 'cancelled'])->default('reserved')->nullable(false)->change();
            });
        }
    }
};
