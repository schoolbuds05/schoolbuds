<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE marketplace_orders MODIFY status ENUM('reserved', 'pending_verification', 'paid', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'reserved'");
    }

    public function down(): void
    {
        DB::statement("UPDATE marketplace_orders SET status = 'cancelled' WHERE status = 'refunded'");
        DB::statement("ALTER TABLE marketplace_orders MODIFY status ENUM('reserved', 'pending_verification', 'paid', 'completed', 'cancelled') NOT NULL DEFAULT 'reserved'");
    }
};
