<?php

namespace App\Domain\Sales\Services;

use App\Domain\Audit\Services\AuditLogger;
use App\Domain\Cash\Services\CashService;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Services\InventoryService;
use App\Domain\Sales\Models\Exchange;
use App\Domain\Sales\Models\Sale;
use App\Domain\Sales\Models\SaleItem;
use App\Domain\Stores\Models\Store;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesService
{
    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly CashService $cashService,
        private readonly AuditLogger $auditLogger,
    ) {
    }

    public function normalSale(Store $store, array $data, User $user): Sale
    {
        return DB::transaction(function () use ($store, $data, $user): Sale {
            $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($data['inventory_item_id']);

            if ($item->status !== 'in_stock') {
                throw ValidationException::withMessages(['inventory_item_id' => 'Item is not available for sale.']);
            }

            $total = (float) ($data['selling_price'] ?? $item->selling_price);
            $profit = $total - (float) $item->purchase_price;

            $sale = Sale::query()->create([
                'store_id' => $store->id,
                'customer_id' => $data['customer_id'] ?? null,
                'sale_number' => $this->nextSaleNumber($store),
                'type' => 'normal',
                'subtotal' => $total,
                'discount' => $data['discount'] ?? 0,
                'total' => $total - (float) ($data['discount'] ?? 0),
                'payment_method' => $data['payment_method'] ?? 'cash',
                'profit' => $profit,
                'created_by' => $user->id,
                'created_at' => now(),
            ]);

            SaleItem::query()->create([
                'sale_id' => $sale->id,
                'inventory_item_id' => $item->id,
                'description' => "{$item->brand} {$item->model}",
                'quantity' => 1,
                'unit_price' => $sale->total,
                'unit_cost' => $item->purchase_price,
                'profit' => $profit,
            ]);

            $this->inventoryService->changeStatus($store, $item, 'sold', 'sale', 'out', $user, $sale);
            $this->cashService->record($store, 'sale_income', 'in', (float) $sale->total, $user, $sale);
            $this->auditLogger->log('sale.created', $store->id, $sale, [], $sale->toArray());

            return $sale->load('items');
        });
    }

    public function exchange(Store $store, array $data, User $user): Exchange
    {
        return DB::transaction(function () use ($store, $data, $user): Exchange {
            $outgoing = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($data['outgoing_item_id']);

            if ($outgoing->status !== 'in_stock') {
                throw ValidationException::withMessages(['outgoing_item_id' => 'Outgoing item is not available.']);
            }

            $incoming = $this->inventoryService->create($store, $data['incoming_item'], $user, null);
            $cashDifference = (float) ($data['cash_difference'] ?? 0);
            $cashDirection = $data['cash_direction'] ?? 'none';
            $outgoingValue = (float) ($data['outgoing_sale_value'] ?? $outgoing->selling_price);
            $incomingValue = (float) ($data['estimated_incoming_value'] ?? $incoming->purchase_price);
            $profitLoss = $outgoingValue - (float) $outgoing->purchase_price - $incomingValue;

            if ($cashDirection === 'customer_pays') {
                $profitLoss += $cashDifference;
            }

            if ($cashDirection === 'store_pays') {
                $profitLoss -= $cashDifference;
            }

            $exchange = Exchange::query()->create([
                'store_id' => $store->id,
                'customer_id' => $data['customer_id'] ?? null,
                'outgoing_item_id' => $outgoing->id,
                'incoming_item_id' => $incoming->id,
                'cash_difference' => $cashDifference,
                'cash_direction' => $cashDirection,
                'estimated_incoming_value' => $incomingValue,
                'outgoing_sale_value' => $outgoingValue,
                'profit_loss' => $profitLoss,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
                'created_at' => now(),
            ]);

            $this->inventoryService->changeStatus($store, $outgoing, 'exchanged_out', 'exchange_out', 'out', $user, $exchange);
            $this->inventoryService->movement($store, $incoming, 'exchange_in', 'in', $user, $exchange);

            if ($cashDirection === 'customer_pays' && $cashDifference > 0) {
                $this->cashService->record($store, 'exchange_income', 'in', $cashDifference, $user, $exchange);
            }

            if ($cashDirection === 'store_pays' && $cashDifference > 0) {
                $this->cashService->record($store, 'exchange_payout', 'out', $cashDifference, $user, $exchange);
            }

            $this->auditLogger->log('exchange.created', $store->id, $exchange, [], $exchange->toArray());

            return $exchange;
        });
    }

    private function nextSaleNumber(Store $store): string
    {
        $count = Sale::query()->where('store_id', $store->id)->whereDate('created_at', today())->count() + 1;

        return sprintf('S-%s-%04d', now()->format('Ymd'), $count);
    }
}
