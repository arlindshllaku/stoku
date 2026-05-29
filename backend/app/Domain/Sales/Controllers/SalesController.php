<?php

namespace App\Domain\Sales\Controllers;

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
                ->with('items')
                ->latest('created_at')
                ->paginate($request->integer('per_page', 25))
        );
    }

    public function normal(NormalSaleRequest $request, Store $store): JsonResponse
    {
        return response()->json($this->salesService->normalSale($store, $request->validated(), $request->user()), 201);
    }

    public function exchange(ExchangeRequest $request, Store $store): JsonResponse
    {
        return response()->json($this->salesService->exchange($store, $request->validated(), $request->user()), 201);
    }
}
