<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('exchanges')) {
            return;
        }

        DB::statement(<<<'SQL'
            UPDATE exchanges
            SET profit_loss = CASE
                WHEN cash_direction = 'customer_pays' THEN cash_difference
                WHEN cash_direction = 'store_pays' THEN -cash_difference
                ELSE 0
            END
        SQL);
    }

    public function down(): void
    {
        // Historical exchange profit/loss values cannot be restored reliably.
    }
};
