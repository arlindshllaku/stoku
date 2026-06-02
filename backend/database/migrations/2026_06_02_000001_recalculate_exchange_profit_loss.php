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

        $incomingValueSql = Schema::hasTable('exchange_incoming_items')
            ? <<<'SQL'
                COALESCE(
                    NULLIF(e.estimated_incoming_value, 0),
                    (
                        SELECT SUM(eii.estimated_value)
                        FROM exchange_incoming_items AS eii
                        WHERE eii.exchange_id = e.id
                    ),
                    (
                        SELECT ii.purchase_price
                        FROM inventory_items AS ii
                        WHERE ii.id = e.incoming_item_id
                    ),
                    0
                )
            SQL
            : <<<'SQL'
                COALESCE(
                    NULLIF(e.estimated_incoming_value, 0),
                    (
                        SELECT ii.purchase_price
                        FROM inventory_items AS ii
                        WHERE ii.id = e.incoming_item_id
                    ),
                    0
                )
            SQL;

        DB::statement(<<<SQL
            UPDATE exchanges AS e
            SET profit_loss =
                {$incomingValueSql}
                + CASE
                    WHEN e.cash_direction = 'customer_pays' THEN e.cash_difference
                    WHEN e.cash_direction = 'store_pays' THEN -e.cash_difference
                    ELSE 0
                END
                - COALESCE(
                    (
                        SELECT oi.purchase_price
                        FROM inventory_items AS oi
                        WHERE oi.id = e.outgoing_item_id
                    ),
                    0
                )
        SQL);
    }

    public function down(): void
    {
        // Historical exchange profit/loss values cannot be restored reliably.
    }
};
