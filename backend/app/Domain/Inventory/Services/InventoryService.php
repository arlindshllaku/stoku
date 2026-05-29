<?php

namespace App\Domain\Inventory\Services;

use App\Domain\Audit\Services\AuditLogger;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryMovement;
use App\Domain\Stores\Models\Store;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

    public function create(Store $store, array $data, User $user, ?string $movementType = 'purchase'): InventoryItem
    {
        return DB::transaction(function () use ($store, $data, $user, $movementType): InventoryItem {
            $item = InventoryItem::query()->create([
                ...$data,
                'store_id' => $store->id,
                'status' => $data['status'] ?? 'in_stock',
                'date_added' => $data['date_added'] ?? now()->toDateString(),
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            if ($movementType !== null) {
                $this->movement($store, $item, $movementType, 'in', $user, $item);
            }
            $this->auditLogger->log('inventory.created', $store->id, $item, [], $item->toArray());

            return $item;
        });
    }

    public function update(Store $store, InventoryItem $item, array $data, User $user): InventoryItem
    {
        return DB::transaction(function () use ($store, $item, $data, $user): InventoryItem {
            $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($item->id);
            $old = $item->toArray();
            $item->update([...$data, 'updated_by' => $user->id]);
            $this->auditLogger->log('inventory.updated', $store->id, $item, $old, $item->fresh()->toArray());

            return $item->fresh();
        });
    }

    public function changeStatus(Store $store, InventoryItem $item, string $status, string $movementType, string $direction, User $user, ?object $reference = null, ?string $notes = null): InventoryItem
    {
        $item = InventoryItem::query()->where('store_id', $store->id)->lockForUpdate()->findOrFail($item->id);
        $old = $item->toArray();
        $item->update(['status' => $status, 'updated_by' => $user->id]);
        $this->movement($store, $item, $movementType, $direction, $user, $reference, $notes);
        $this->auditLogger->log('inventory.status_changed', $store->id, $item, $old, $item->fresh()->toArray(), ['movement_type' => $movementType]);

        return $item->fresh();
    }

    public function movement(Store $store, InventoryItem $item, string $type, string $direction, User $user, ?object $reference = null, ?string $notes = null): InventoryMovement
    {
        return InventoryMovement::query()->create([
            'store_id' => $store->id,
            'inventory_item_id' => $item->id,
            'type' => $type,
            'direction' => $direction,
            'quantity' => 1,
            'unit_cost' => $item->purchase_price,
            'unit_price' => $item->selling_price,
            'reference_type' => $reference ? $reference::class : null,
            'reference_id' => $reference->id ?? null,
            'notes' => $notes,
            'created_by' => $user->id,
            'created_at' => now(),
        ]);
    }
}
