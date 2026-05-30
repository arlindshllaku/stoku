<?php

namespace App\Domain\Purchases\Controllers;

use App\Domain\Purchases\Models\Purchase;
use App\Domain\Purchases\Requests\PurchaseRequest;
use App\Domain\Purchases\Services\PurchaseService;
use App\Domain\Stores\Models\Store;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    public function __construct(private readonly PurchaseService $purchaseService)
    {
    }

    public function index(Request $request, Store $store): JsonResponse
    {
        return response()->json(
            Purchase::query()
                ->where('store_id', $store->id)
                ->latest('created_at')
                ->paginate($request->integer('per_page', 25))
        );
    }

    public function store(PurchaseRequest $request, Store $store): JsonResponse
    {
        return response()->json($this->purchaseService->fromCustomer($store, $request->validated(), $request->user()), 201);
    }
}
