<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_sequences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->date('business_date');
            $table->unsignedInteger('next_number')->default(1);
            $table->timestamps();
            $table->unique(['store_id', 'type', 'business_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_sequences');
    }
};
