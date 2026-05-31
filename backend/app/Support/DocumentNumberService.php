<?php

namespace App\Support;

use App\Domain\Stores\Models\Store;
use Illuminate\Support\Facades\DB;

class DocumentNumberService
{
    public function next(Store $store, string $type, string $prefix): string
    {
        $date = today();
        $now = now();
        $initialNextNumber = $this->initialNextNumber($store, $type, $prefix, $date->format('Ymd'));

        DB::table('document_sequences')->insertOrIgnore([
            'store_id' => $store->id,
            'type' => $type,
            'business_date' => $date->toDateString(),
            'next_number' => $initialNextNumber,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $sequence = DB::table('document_sequences')
            ->where('store_id', $store->id)
            ->where('type', $type)
            ->where('business_date', $date->toDateString())
            ->lockForUpdate()
            ->first();

        $number = (int) $sequence->next_number;

        DB::table('document_sequences')
            ->where('id', $sequence->id)
            ->update([
                'next_number' => $number + 1,
                'updated_at' => $now,
            ]);

        return sprintf('%s-%s-%04d', $prefix, $date->format('Ymd'), $number);
    }

    private function initialNextNumber(Store $store, string $type, string $prefix, string $date): int
    {
        [$table, $column] = match ($type) {
            'purchase' => ['purchases', 'purchase_number'],
            default => ['sales', 'sale_number'],
        };

        $prefixWithDate = "{$prefix}-{$date}-";
        $latestNumber = DB::table($table)
            ->where('store_id', $store->id)
            ->where($column, 'like', "{$prefixWithDate}%")
            ->orderByDesc($column)
            ->value($column);

        if (! is_string($latestNumber)) {
            return 1;
        }

        return ((int) substr($latestNumber, strlen($prefixWithDate))) + 1;
    }
}
