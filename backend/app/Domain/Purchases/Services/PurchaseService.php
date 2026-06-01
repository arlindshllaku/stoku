<?php

namespace App\Domain\Purchases\Services;

use App\Domain\Audit\Services\AuditLogger;
use App\Domain\Cash\Services\CashService;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Services\InventoryService;
use App\Domain\Purchases\Models\Purchase;
use App\Domain\Stores\Models\Store;
use App\Models\User;
use App\Support\DocumentNumberService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly CashService $cashService,
        private readonly AuditLogger $auditLogger,
        private readonly DocumentNumberService $documentNumberService,
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

            return $purchase->load('item');
        });
    }

    public function update(Store $store, Purchase $purchase, array $data, User $user): Purchase
    {
        return DB::transaction(function () use ($store, $purchase, $data, $user): Purchase {
            $purchase = Purchase::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($purchase->id);
            $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($purchase->inventory_item_id);
            $this->ensureEditableItem($item);

            $old = $purchase->load('item')->toArray();
            $purchasePrice = (float) ($data['purchase_price'] ?? $data['incoming_item']['purchase_price'] ?? 0);
            $expectedSellingPrice = (float) ($data['expected_selling_price'] ?? $data['incoming_item']['selling_price'] ?? 0);
            $priceDifference = $purchasePrice - (float) $purchase->purchase_price;

            $item->update([
                ...$data['incoming_item'],
                'purchase_price' => $purchasePrice,
                'selling_price' => $expectedSellingPrice,
                'updated_by' => $user->id,
            ]);

            $purchase->update([
                'customer_id' => $data['customer_id'] ?? null,
                'purchase_price' => $purchasePrice,
                'expected_selling_price' => $expectedSellingPrice,
                'notes' => $data['notes'] ?? null,
            ]);

            if ($priceDifference > 0) {
                $this->cashService->record($store, 'customer_purchase_adjustment', 'out', $priceDifference, $user, $purchase, 'Korrigjim blerjeje');
            }

            if ($priceDifference < 0) {
                $this->cashService->record($store, 'customer_purchase_reversal', 'in', abs($priceDifference), $user, $purchase, 'Kthim nga korrigjimi i blerjes');
            }

            $this->auditLogger->log('purchase.updated', $store->id, $purchase, $old, $purchase->fresh(['item'])->toArray());

            return $purchase->fresh(['item']);
        });
    }

    public function delete(Store $store, Purchase $purchase, User $user): void
    {
        DB::transaction(function () use ($store, $purchase, $user): void {
            $purchase = Purchase::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($purchase->id);
            $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($purchase->inventory_item_id);
            $this->ensureEditableItem($item);

            $old = $purchase->load('item')->toArray();

            if ((float) $purchase->purchase_price > 0) {
                $this->cashService->record($store, 'customer_purchase_reversal', 'in', (float) $purchase->purchase_price, $user, $purchase, 'Fshirje blerjeje');
            }

            $purchase->delete();
            $item->delete();
            $this->auditLogger->log('purchase.deleted', $store->id, $purchase, $old, [
                'inventory_item_id' => $item->id,
                'purchase_price' => $old['purchase_price'] ?? null,
            ]);
        });
    }

    private function nextPurchaseNumber(Store $store): string
    {
        return $this->documentNumberService->next($store, 'purchase', 'P');
    }

    private function ensureEditableItem(InventoryItem $item): void
    {
        if (in_array($item->status, ['sold', 'exchanged_out'], true)) {
            throw ValidationException::withMessages([
                'purchase' => 'Blerja nuk mund të ndryshohet sepse telefoni ka dalë nga stoku.',
            ]);
        }
    }
}
