<?php

namespace App\Domain\Inventory\Controllers;

use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Requests\InventoryItemRequest;
use App\Domain\Inventory\Services\InventoryService;
use App\Domain\Stores\Models\Store;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventoryService)
    {
    }

    public function index(Request $request, Store $store): JsonResponse
    {
        $query = InventoryItem::query()->where('store_id', $store->id)->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(fn ($q) => $q
                ->where('imei', 'ilike', "%{$search}%")
                ->orWhere('brand', 'ilike', "%{$search}%")
                ->orWhere('model', 'ilike', "%{$search}%"));
        }

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function store(InventoryItemRequest $request, Store $store): JsonResponse
    {
        return response()->json($this->inventoryService->create($store, $request->validated(), $request->user()), 201);
    }

    public function show(Store $store, InventoryItem $inventory): JsonResponse
    {
        abort_unless($inventory->store_id === $store->id, 404);

        return response()->json($inventory->load('movements'));
    }

    public function update(InventoryItemRequest $request, Store $store, InventoryItem $inventory): JsonResponse
    {
        abort_unless($inventory->store_id === $store->id, 404);

        return response()->json($this->inventoryService->update($store, $inventory, $request->validated(), $request->user()));
    }

    public function destroy(Store $store, InventoryItem $inventory): JsonResponse
    {
        abort_unless($inventory->store_id === $store->id, 404);
        $this->inventoryService->changeStatus($store, $inventory, 'damaged', 'adjustment', 'out', request()->user(), null, 'Soft removed from stock');

        return response()->json(['message' => 'Item removed from active stock']);
    }

    public function adjust(Request $request, Store $store, InventoryItem $inventory): JsonResponse
    {
        abort_unless($inventory->store_id === $store->id, 404);
        $data = $request->validate([
            'status' => ['required', 'in:in_stock,reserved,damaged,returned'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json($this->inventoryService->changeStatus($store, $inventory, $data['status'], 'adjustment', 'in', $request->user(), null, $data['notes'] ?? null));
    }

    public function movements(Store $store, InventoryItem $inventory): JsonResponse
    {
        abort_unless($inventory->store_id === $store->id, 404);

        return response()->json($inventory->movements()->latest('created_at')->paginate(50));
    }
}
