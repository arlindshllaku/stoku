<?php

namespace App\Domain\Sales\Controllers;

use App\Domain\Sales\Models\Exchange;
use App\Domain\Sales\Models\Sale;
use App\Domain\Sales\Requests\ExchangeRequest;
use App\Domain\Sales\Requests\NormalSaleRequest;
use App\Domain\Sales\Services\SalesService;
use App\Domain\Stores\Models\Store;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalesController extends Controller
{
    public function __construct(private readonly SalesService $salesService)
    {
    }

    public function index(Request $request, Store $store): JsonResponse
    {
        return response()->json(
            Sale::query()
                ->where('store_id', $store->id)
                ->with('items.inventoryItem')
                ->latest('created_at')
                ->paginate($request->integer('per_page', 25))
        );
    }

    public function exchanges(Request $request, Store $store): JsonResponse
    {
        return response()->json(
            Exchange::query()
                ->where('store_id', $store->id)
                ->with(['outgoingItem', 'incomingItem', 'incomingItems.item'])
                ->latest('created_at')
                ->paginate($request->integer('per_page', 25))
        );
    }

    public function normal(NormalSaleRequest $request, Store $store): JsonResponse
    {
        return response()->json($this->salesService->normalSale($store, $request->validated(), $request->user()), 201);
    }

    public function update(Request $request, Store $store, Sale $sale): JsonResponse
    {
        abort_unless($sale->store_id === $store->id, 404);

        $data = $request->validate([
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'in:cash,card,mixed,other'],
        ]);

        return response()->json($this->salesService->updateNormalSale($store, $sale, $data, $request->user()));
    }

    public function destroy(Request $request, Store $store, Sale $sale): JsonResponse
    {
        abort_unless($sale->store_id === $store->id, 404);

        $this->salesService->deleteNormalSale($store, $sale, $request->user());

        return response()->json(['message' => 'Shitja u fshi dhe arka/stoku u korrigjuan.']);
    }

    public function exchange(ExchangeRequest $request, Store $store): JsonResponse
    {
        return response()->json($this->salesService->exchange($store, $request->validated(), $request->user()), 201);
    }
}
