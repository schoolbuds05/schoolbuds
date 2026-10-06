<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE marketplace_orders MODIFY payment_method ENUM('cash', 'gcash', 'qrph') NOT NULL");
        DB::statement("ALTER TABLE marketplace_orders MODIFY status ENUM('reserved', 'pending_verification', 'paid', 'completed', 'cancelled') NOT NULL DEFAULT 'reserved'");
    }

    public function down(): void
    {
        DB::statement("UPDATE marketplace_orders SET payment_method = 'gcash' WHERE payment_method = 'qrph'");
        DB::statement("UPDATE marketplace_orders SET status = 'reserved' WHERE status = 'pending_verification'");
        DB::statement("ALTER TABLE marketplace_orders MODIFY payment_method ENUM('cash', 'gcash') NOT NULL");
        DB::statement("ALTER TABLE marketplace_orders MODIFY status ENUM('reserved', 'paid', 'completed', 'cancelled') NOT NULL DEFAULT 'reserved'");
    }
};
