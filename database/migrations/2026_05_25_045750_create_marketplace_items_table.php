<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('marketplace_items', function (Blueprint $table) {
        $table->id();
        $table->foreignId('user_id')->constrained()->onDelete('cascade');
        $table->string('title');
        $table->text('description');
        $table->decimal('price', 10, 2);
        $table->enum('category', ['books', 'uniforms', 'electronics', 'supplies', 'other']);
        $table->enum('condition', ['new', 'like_new', 'good', 'fair']);
        $table->enum('status', ['available', 'sold', 'reserved'])->default('available');
        $table->string('image')->nullable();
        $table->string('location')->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('marketplace_items');
    }
};
