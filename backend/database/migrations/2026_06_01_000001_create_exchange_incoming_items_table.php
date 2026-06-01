<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exchange_incoming_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('exchange_id')->constrained('exchanges')->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->decimal('estimated_value', 12, 2)->default(0);
            $table->timestamps();
            $table->unique(['exchange_id', 'inventory_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exchange_incoming_items');
    }
};
