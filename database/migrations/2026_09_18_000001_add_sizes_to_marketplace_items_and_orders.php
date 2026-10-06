<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_items', function (Blueprint $table) {
            if (!Schema::hasColumn('marketplace_items', 'size_options')) {
                $table->json('size_options')->nullable()->after('category');
            }
        });

        Schema::table('marketplace_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('marketplace_orders', 'size')) {
                $table->string('size', 30)->nullable()->after('quantity');
            }
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_orders', function (Blueprint $table) {
            if (Schema::hasColumn('marketplace_orders', 'size')) {
                $table->dropColumn('size');
            }
        });

        Schema::table('marketplace_items', function (Blueprint $table) {
            if (Schema::hasColumn('marketplace_items', 'size_options')) {
                $table->dropColumn('size_options');
            }
        });
    }
};
