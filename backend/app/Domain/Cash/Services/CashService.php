<?php

namespace App\Domain\Cash\Services;

use App\Domain\Cash\Models\CashRegister;
use App\Domain\Cash\Models\CashTransaction;
use App\Domain\Stores\Models\Store;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashService
{
    public function registerFor(Store $store): CashRegister
    {
        return CashRegister::query()->firstOrCreate(
            ['store_id' => $store->id],
            ['current_balance' => 0, 'opening_balance' => 0],
        );
    }

    public function record(Store $store, string $type, string $direction, float $amount, ?User $user, ?object $reference = null, ?string $notes = null): CashTransaction
    {
        return DB::transaction(function () use ($store, $type, $direction, $amount, $user, $reference, $notes): CashTransaction {
            $this->registerFor($store);
            $register = CashRegister::query()->where('store_id', $store->id)->lockForUpdate()->firstOrFail();
            $delta = $direction === 'in' ? $amount : -$amount;
            $balanceAfter = (float) $register->current_balance + $delta;

            if ($balanceAfter < 0) {
                throw ValidationException::withMessages(['amount' => 'Arka nuk ka saldo të mjaftueshme për këtë dalje.']);
            }

            $register->update(['current_balance' => $balanceAfter]);

            return CashTransaction::query()->create([
                'store_id' => $store->id,
                'cash_register_id' => $register->id,
                'type' => $type,
                'direction' => $direction,
                'amount' => $amount,
                'balance_after' => $balanceAfter,
                'reference_type' => $reference ? $reference::class : null,
                'reference_id' => $reference->id ?? null,
                'notes' => $notes,
                'created_by' => $user?->id,
                'created_at' => now(),
            ]);
        });
    }
}
