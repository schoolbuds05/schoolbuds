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
    Schema::create('fees', function (Blueprint $table) {
        $table->id();
        $table->foreignId('student_id')->constrained()->onDelete('cascade');
        $table->string('type');
        $table->decimal('amount', 10, 2);
        $table->decimal('paid_amount', 10, 2)->default(0);
        $table->enum('status', ['unpaid', 'partial', 'paid'])->default('unpaid');
        $table->date('due_date');
        $table->date('paid_date')->nullable();
        $table->string('school_year');
        $table->string('quarter')->nullable();
        $table->text('notes')->nullable();
        $table->timestamps();
    });
}
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fees');
    }
};
