<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['store_id', 'phone']);
        });

        Schema::create('sales', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('sale_number');
            $table->string('type')->default('normal');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->string('payment_method')->default('cash');
            $table->decimal('profit', 12, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['store_id', 'sale_number']);
            $table->index(['store_id', 'created_at']);
        });

        Schema::create('sale_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained('inventory_items')->nullOnDelete();
            $table->string('description');
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->decimal('profit', 12, 2)->default(0);
        });

        Schema::create('exchanges', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('outgoing_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->foreignId('incoming_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->decimal('cash_difference', 12, 2)->default(0);
            $table->string('cash_direction')->default('none');
            $table->decimal('estimated_incoming_value', 12, 2)->default(0);
            $table->decimal('outgoing_sale_value', 12, 2)->default(0);
            $table->decimal('profit_loss', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['store_id', 'created_at']);
        });

        Schema::create('cash_registers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('current_balance', 12, 2)->default(0);
            $table->decimal('opening_balance', 12, 2)->default(0);
            $table->timestamp('last_closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('cash_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cash_register_id')->constrained()->cascadeOnDelete();
            $table->string('type')->index();
            $table->string('direction');
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['store_id', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
        });

        Schema::create('cash_daily_closures', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->date('business_date');
            $table->decimal('opening_balance', 12, 2);
            $table->decimal('sales_income', 12, 2)->default(0);
            $table->decimal('exchange_income', 12, 2)->default(0);
            $table->decimal('exchange_payouts', 12, 2)->default(0);
            $table->decimal('expenses', 12, 2)->default(0);
            $table->decimal('manual_deposits', 12, 2)->default(0);
            $table->decimal('manual_withdrawals', 12, 2)->default(0);
            $table->decimal('expected_closing_balance', 12, 2);
            $table->decimal('actual_closing_balance', 12, 2);
            $table->decimal('difference', 12, 2);
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at');
            $table->unique(['store_id', 'business_date']);
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('store_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action')->index();
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['store_id', 'created_at']);
            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('cash_daily_closures');
        Schema::dropIfExists('cash_transactions');
        Schema::dropIfExists('cash_registers');
        Schema::dropIfExists('exchanges');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('customers');
    }
};
