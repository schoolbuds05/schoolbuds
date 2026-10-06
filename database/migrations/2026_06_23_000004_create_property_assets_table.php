<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_tag')->unique();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('location')->nullable();
            $table->string('condition')->default('good');
            $table->string('status')->default('available');
            $table->string('assigned_to')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'condition']);
            $table->index(['category', 'location']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_assets');
    }
};
