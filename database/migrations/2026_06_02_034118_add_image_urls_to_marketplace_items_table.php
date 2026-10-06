<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketplace_items', function (Blueprint $table) {
            if (!Schema::hasColumn('marketplace_items', 'image_urls')) {
                $table->json('image_urls')->nullable()->after('image');
            }
        });
    }

    public function down(): void
    {
        Schema::table('marketplace_items', function (Blueprint $table) {
            if (Schema::hasColumn('marketplace_items', 'image_urls')) {
                $table->dropColumn('image_urls');
            }
        });
    }
};
