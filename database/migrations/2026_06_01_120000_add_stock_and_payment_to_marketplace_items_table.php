<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_items', function (Blueprint $table) {
            $table->unsignedInteger('stock')->default(1)->after('price');
            $table->boolean('accepts_cash')->default(true)->after('location');
            $table->boolean('accepts_gcash')->default(false)->after('accepts_cash');
            $table->string('gcash_name')->nullable()->after('accepts_gcash');
            $table->string('gcash_number')->nullable()->after('gcash_name');
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_items', function (Blueprint $table) {
            $table->dropColumn([
                'stock',
                'accepts_cash',
                'accepts_gcash',
                'gcash_name',
                'gcash_number',
            ]);
        });
    }
};
