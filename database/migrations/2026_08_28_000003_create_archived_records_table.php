<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('archived_records', function (Blueprint $table) {
            $table->id();
            $table->string('record_type');
            $table->unsignedBigInteger('record_id')->nullable();
            $table->string('label')->nullable();
            $table->json('payload');
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source')->nullable();
            $table->timestamp('deleted_at')->useCurrent();
            $table->timestamps();

            $table->index(['record_type', 'record_id']);
            $table->index(['deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('archived_records');
    }
};
