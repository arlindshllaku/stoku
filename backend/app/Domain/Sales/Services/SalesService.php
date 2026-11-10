<?php

namespace App\Domain\Sales\Services;

use App\Domain\Audit\Services\AuditLogger;
use App\Domain\Cash\Services\CashService;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryMovement;
use App\Domain\Inventory\Services\InventoryService;
use App\Domain\Sales\Models\Exchange;
use App\Domain\Sales\Models\ExchangeIncomingItem;
use App\Domain\Sales\Models\Sale;
use App\Domain\Sales\Models\SaleItem;
use App\Domain\Stores\Models\Store;
use App\Models\User;
use App\Support\DocumentNumberService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesService
{
    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly CashService $cashService,
        private readonly AuditLogger $auditLogger,
        private readonly DocumentNumberService $documentNumberService,
    ) {}

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

            $incomingItems = collect($data['incoming_items']);
            $createdIncomingItems = $incomingItems->map(
                fn (array $incomingItem) => $this->inventoryService->receiveExchange($store, $incomingItem, $user),
            );
            $cashDifference = (float) ($data['cash_difference'] ?? 0);
            $cashDirection = $data['cash_direction'] ?? 'none';
            $incomingValue = (float) ($data['estimated_incoming_value'] ?? $createdIncomingItems->sum(fn (InventoryItem $item) => $item->purchase_price));
            $cashImpact = match ($cashDirection) {
                'customer_pays' => $cashDifference,
                'store_pays' => -$cashDifference,
                default => 0,
            };
            $outgoingValue = (float) ($data['outgoing_sale_value'] ?? max($incomingValue + $cashImpact, 0));
            $profitLoss = $cashImpact;

            $exchange = Exchange::query()->create([
                'store_id' => $store->id,
                'customer_id' => $data['customer_id'] ?? null,
                'outgoing_item_id' => $outgoing->id,
                'incoming_item_id' => $createdIncomingItems->first()->id,
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
            $createdIncomingItems->each(function (InventoryItem $incoming) use ($store, $user, $exchange): void {
                ExchangeIncomingItem::query()->create([
                    'exchange_id' => $exchange->id,
                    'inventory_item_id' => $incoming->id,
                    'estimated_value' => $incoming->purchase_price,
                ]);

                $this->inventoryService->movement($store, $incoming, 'exchange_in', 'in', $user, $exchange);
            });

            if ($cashDirection === 'customer_pays' && $cashDifference > 0) {
                $this->cashService->record($store, 'exchange_income', 'in', $cashDifference, $user, $exchange);
            }

            if ($cashDirection === 'store_pays' && $cashDifference > 0) {
                $this->cashService->record($store, 'exchange_payout', 'out', $cashDifference, $user, $exchange);
            }

            $this->auditLogger->log('exchange.created', $store->id, $exchange, [], $exchange->toArray());

            return $exchange->load('incomingItems.item');
        });
    }

    public function updateNormalSale(Store $store, Sale $sale, array $data, User $user): Sale
    {
        return DB::transaction(function () use ($store, $sale, $data, $user): Sale {
            $sale = Sale::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($sale->id);
            $this->ensureNormalSale($sale);
            $this->ensureSaleNotReturned($sale);

            $saleItem = SaleItem::query()->where('sale_id', $sale->id)->lockForUpdate()->firstOrFail();
            $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($saleItem->inventory_item_id);
            $old = $sale->load('items.inventoryItem')->toArray();

            if ($item->status !== 'sold') {
                throw ValidationException::withMessages([
                    'sale' => 'Shitja nuk mund të ndryshohet sepse telefoni nuk është më i shënuar si i shitur.',
                ]);
            }

            $subtotal = (float) ($data['selling_price'] ?? $sale->subtotal);
            $discount = (float) ($data['discount'] ?? $sale->discount);
            $total = max($subtotal - $discount, 0);
            $profit = $total - (float) $saleItem->unit_cost;
            $cashDifference = $total - (float) $sale->total;

            $sale->update([
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'payment_method' => $data['payment_method'] ?? $sale->payment_method,
                'profit' => $profit,
            ]);

            $saleItem->update([
                'unit_price' => $total,
                'profit' => $profit,
            ]);

            if ($cashDifference > 0) {
                $this->cashService->record($store, 'sale_adjustment', 'in', $cashDifference, $user, $sale, 'Korrigjim shitjeje');
            }

            if ($cashDifference < 0) {
                $this->cashService->record($store, 'sale_reversal', 'out', abs($cashDifference), $user, $sale, 'Kthim nga korrigjimi i shitjes');
            }

            $this->auditLogger->log('sale.updated', $store->id, $sale, $old, $sale->fresh(['items.inventoryItem'])->toArray());

            return $sale->fresh(['items.inventoryItem']);
        });
    }

    public function updateExchange(Store $store, Exchange $exchange, array $data, User $user): Exchange
    {
        return DB::transaction(function () use ($store, $exchange, $data, $user): Exchange {
            $exchange = Exchange::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($exchange->id);
            $old = $exchange->load(['outgoingItem', 'incomingItem', 'incomingItems.item'])->toArray();
            $oldOutgoing = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($exchange->outgoing_item_id);
            $lastOutgoing = $oldOutgoing->movements()->where('direction', 'out')->latest('id')->first();
            if ($lastOutgoing && ($lastOutgoing->reference_type !== Exchange::class || (int) $lastOutgoing->reference_id !== $exchange->id)) {
                throw ValidationException::withMessages(['exchange' => 'Telefoni ka qarkulluar përsëri. Ndërrimi origjinal ruhet në historik.']);
            }
            $newOutgoing = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($data['outgoing_item_id']);

            if ($oldOutgoing->id !== $newOutgoing->id) {
                if ($oldOutgoing->status !== 'exchanged_out') {
                    throw ValidationException::withMessages([
                        'outgoing_item_id' => 'Telefoni i vjetër dalës nuk është më i shënuar si i dalë në ndërrim.',
                    ]);
                }

                if ($newOutgoing->status !== 'in_stock') {
                    throw ValidationException::withMessages([
                        'outgoing_item_id' => 'Telefoni i ri dalës nuk është në stok.',
                    ]);
                }

                $this->inventoryService->changeStatus($store, $oldOutgoing, 'in_stock', 'exchange_edit_reversal', 'in', $user, $exchange, 'Korrigjim ndërrimi');
                $this->inventoryService->changeStatus($store, $newOutgoing, 'exchanged_out', 'exchange_edit', 'out', $user, $exchange, 'Korrigjim ndërrimi');
            } elseif ($newOutgoing->status !== 'exchanged_out') {
                throw ValidationException::withMessages([
                    'outgoing_item_id' => 'Telefoni dalës nuk është më i shënuar si i dalë në ndërrim.',
                ]);
            }

            $existingLinks = ExchangeIncomingItem::query()
                ->where('exchange_id', $exchange->id)
                ->lockForUpdate()
                ->get()
                ->keyBy('inventory_item_id');

            if ($exchange->incoming_item_id && ! $existingLinks->has($exchange->incoming_item_id)) {
                $legacyLink = ExchangeIncomingItem::query()->firstOrCreate(
                    [
                        'exchange_id' => $exchange->id,
                        'inventory_item_id' => $exchange->incoming_item_id,
                    ],
                    ['estimated_value' => $exchange->estimated_incoming_value],
                );
                $existingLinks->put($legacyLink->inventory_item_id, $legacyLink);
            }

            $submittedIncomingIds = collect();
            $incomingItems = collect($data['incoming_items'])->map(function (array $incomingData) use ($store, $exchange, $existingLinks, $submittedIncomingIds, $user): InventoryItem {
                $incomingId = $incomingData['id'] ?? null;
                unset($incomingData['id']);

                if ($incomingId) {
                    $link = $existingLinks->get($incomingId);

                    if (! $link) {
                        throw ValidationException::withMessages(['incoming_items' => 'Telefoni hyrës nuk i përket këtij ndërrimi.']);
                    }

                    $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($incomingId);
                    $this->ensureIncomingItemCanBeEdited($item, $exchange);
                    $item = $this->inventoryService->update($store, $item, $incomingData, $user);
                    $link->update(['estimated_value' => $item->purchase_price]);
                    $submittedIncomingIds->push($item->id);

                    return $item;
                }

                $item = $this->inventoryService->receiveExchange($store, $incomingData, $user);
                ExchangeIncomingItem::query()->create([
                    'exchange_id' => $exchange->id,
                    'inventory_item_id' => $item->id,
                    'estimated_value' => $item->purchase_price,
                ]);
                $this->inventoryService->movement($store, $item, 'exchange_in', 'in', $user, $exchange, 'Shtuar gjatë korrigjimit të ndërrimit');
                $submittedIncomingIds->push($item->id);

                return $item;
            });

            $exchange->update(['incoming_item_id' => $incomingItems->first()->id]);

            $existingLinks
                ->reject(fn (ExchangeIncomingItem $link) => $submittedIncomingIds->contains($link->inventory_item_id))
                ->each(function (ExchangeIncomingItem $link) use ($store, $exchange): void {
                    $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($link->inventory_item_id);
                    $this->ensureIncomingItemCanBeEdited($item, $exchange);
                    throw ValidationException::withMessages(['incoming_items' => 'Telefoni i pranuar nuk mund të hiqet nga historiku i ndërrimit.']);
                });

            $cashDifference = (float) ($data['cash_difference'] ?? 0);
            $cashDirection = $data['cash_direction'] ?? 'none';
            $incomingValue = (float) ($data['estimated_incoming_value'] ?? $incomingItems->sum(fn (InventoryItem $item) => $item->purchase_price));
            $newCashImpact = $this->exchangeCashImpact($cashDirection, $cashDifference);
            $oldCashImpact = $this->exchangeCashImpact($exchange->cash_direction, (float) $exchange->cash_difference);
            $cashDelta = $newCashImpact - $oldCashImpact;
            $outgoingValue = (float) ($data['outgoing_sale_value'] ?? max($incomingValue + $newCashImpact, 0));

            $exchange->update([
                'customer_id' => $data['customer_id'] ?? $exchange->customer_id,
                'outgoing_item_id' => $newOutgoing->id,
                'cash_difference' => $cashDifference,
                'cash_direction' => $cashDirection,
                'estimated_incoming_value' => $incomingValue,
                'outgoing_sale_value' => $outgoingValue,
                'profit_loss' => $newCashImpact,
                'notes' => $data['notes'] ?? null,
            ]);

            if ($cashDelta > 0) {
                $this->cashService->record($store, 'exchange_adjustment', 'in', $cashDelta, $user, $exchange, 'Korrigjim ndërrimi');
            }

            if ($cashDelta < 0) {
                $this->cashService->record($store, 'exchange_reversal', 'out', abs($cashDelta), $user, $exchange, 'Korrigjim ndërrimi');
            }

            $fresh = $exchange->fresh(['outgoingItem', 'incomingItem', 'incomingItems.item']);
            $this->auditLogger->log('exchange.updated', $store->id, $exchange, $old, $fresh->toArray());

            return $fresh;
        });
    }

    public function deleteNormalSale(Store $store, Sale $sale, User $user): void
    {
        DB::transaction(function () use ($store, $sale, $user): void {
            $sale = Sale::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($sale->id);
            $this->ensureNormalSale($sale);
            $this->ensureSaleNotReturned($sale);

            $saleItem = SaleItem::query()->where('sale_id', $sale->id)->lockForUpdate()->firstOrFail();
            $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($saleItem->inventory_item_id);
            $old = $sale->load('items.inventoryItem')->toArray();

            if ($item->status === 'sold') {
                $this->inventoryService->changeStatus($store, $item, 'in_stock', 'sale_reversal', 'in', $user, $sale, 'Fshirje shitjeje');
            }

            if ((float) $sale->total > 0) {
                $this->cashService->record($store, 'sale_reversal', 'out', (float) $sale->total, $user, $sale, 'Fshirje shitjeje');
            }

            $sale->delete();
            $this->auditLogger->log('sale.deleted', $store->id, $sale, $old, [
                'inventory_item_id' => $item->id,
                'total' => $old['total'] ?? null,
            ]);
        });
    }

    private function nextSaleNumber(Store $store): string
    {
        return $this->documentNumberService->next($store, 'sale', 'S');
    }

    private function ensureSaleNotReturned(Sale $sale): void
    {
        $ids = $sale->items()->pluck('inventory_item_id');
        $saleMovement = InventoryMovement::query()->where('reference_type', Sale::class)
            ->where('reference_id', $sale->id)->where('type', 'sale')->max('id');
        if (InventoryMovement::query()
            ->whereIn('inventory_item_id', $ids)->where('type', 'exchange_in')
            ->when($saleMovement, fn ($query) => $query->where('id', '>', $saleMovement),
                fn ($query) => $query->where('created_at', '>', $sale->created_at))->exists()) {
            throw ValidationException::withMessages(['sale' => 'Telefoni është kthyer në ndërrim. Shitja origjinale ruhet në historik.']);
        }
    }

    private function ensureNormalSale(Sale $sale): void
    {
        if ($sale->type !== 'normal') {
            throw ValidationException::withMessages([
                'sale' => 'Vetëm shitjet normale mund të editohen ose fshihen nga ky ekran.',
            ]);
        }
    }

    private function ensureIncomingItemCanBeEdited(InventoryItem $item, Exchange $exchange): void
    {
        $receivedMovement = $item->movements()->where('type', 'exchange_in')
            ->where('reference_type', Exchange::class)->where('reference_id', $exchange->id)->max('id');
        if ($item->movements()->where('type', 'exchange_in')->where('reference_id', '!=', $exchange->id)
            ->when($receivedMovement, fn ($query) => $query->where('id', '>', $receivedMovement),
                fn ($query) => $query->where('created_at', '>', $exchange->created_at))->exists()) {
            throw ValidationException::withMessages(['incoming_items' => 'Telefoni ka hyrë në një ndërrim të mëvonshëm.']);
        }
        if (in_array($item->status, ['sold', 'exchanged_out'], true)) {
            throw ValidationException::withMessages([
                'incoming_items' => 'Ndërrimi nuk mund të editohet sepse një telefon hyrës është shitur ose ka dalë në ndërrim tjetër.',
            ]);
        }
    }

    private function exchangeCashImpact(string $direction, float $difference): float
    {
        return match ($direction) {
            'customer_pays' => $difference,
            'store_pays' => -$difference,
            default => 0,
        };
    }
}
