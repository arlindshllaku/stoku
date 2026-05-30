<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Audit\Services\AuditLogger;
use App\Domain\Cash\Services\CashService;
use App\Domain\Inventory\Services\InventoryService;
use App\Domain\Purchases\Models\Purchase;
use App\Domain\Stores\Models\Store;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly CashService $cashService,
        private readonly AuditLogger $auditLogger,
    ) {
    }

    public function fromCustomer(Store $store, array $data, User $user): Purchase
    {
        return DB::transaction(function () use ($store, $data, $user): Purchase {
            $purchasePrice = (float) ($data['purchase_price'] ?? $data['incoming_item']['purchase_price'] ?? 0);
            $expectedSellingPrice = (float) ($data['expected_selling_price'] ?? $data['incoming_item']['selling_price'] ?? 0);
            $incomingItem = [
                ...$data['incoming_item'],
                'purchase_price' => $purchasePrice,
                'selling_price' => $expectedSellingPrice,
            ];

            $item = $this->inventoryService->create($store, $incomingItem, $user, 'customer_purchase');

            $purchase = Purchase::query()->create([
                'store_id' => $store->id,
                'customer_id' => $data['customer_id'] ?? null,
                'inventory_item_id' => $item->id,
                'purchase_number' => $this->nextPurchaseNumber($store),
                'purchase_price' => $purchasePrice,
                'expected_selling_price' => $expectedSellingPrice,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
                'created_at' => now(),
            ]);

            if ($purchasePrice > 0) {
                $this->cashService->record($store, 'customer_purchase_payout', 'out', $purchasePrice, $user, $purchase, $data['notes'] ?? null);
            }

            $this->auditLogger->log('purchase.created', $store->id, $purchase, [], $purchase->toArray());

            return $purchase;
        });
    }

    private function nextPurchaseNumber(Store $store): string
    {
        $count = Purchase::query()->where('store_id', $store->id)->whereDate('created_at', today())->count() + 1;

        return sprintf('P-%s-%04d', now()->format('Ymd'), $count);
    }
}
