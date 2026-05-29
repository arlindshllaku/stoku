<?php

namespace App\Domain\Cash\Controllers;

use App\Domain\Cash\Models\CashTransaction;
use App\Domain\Cash\Services\CashService;
use App\Domain\Stores\Models\Store;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CashController extends Controller
{
    public function __construct(private readonly CashService $cashService)
    {
    }

    public function show(Request $request, Store $store): JsonResponse
    {
        return response()->json([
            'register' => $this->cashService->registerFor($store),
            'transactions' => CashTransaction::query()
                ->where('store_id', $store->id)
                ->latest('created_at')
                ->paginate($request->integer('per_page', 25)),
        ]);
    }

    public function deposit(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate(['amount' => ['required', 'numeric', 'min:0.01'], 'notes' => ['nullable', 'string']]);

        return response()->json($this->cashService->record($store, 'manual_deposit', 'in', (float) $data['amount'], $request->user(), null, $data['notes'] ?? null), 201);
    }

    public function withdraw(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate(['amount' => ['required', 'numeric', 'min:0.01'], 'notes' => ['nullable', 'string']]);

        return response()->json($this->cashService->record($store, 'manual_withdrawal', 'out', (float) $data['amount'], $request->user(), null, $data['notes'] ?? null), 201);
    }

    public function expense(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate(['amount' => ['required', 'numeric', 'min:0.01'], 'notes' => ['required', 'string']]);

        return response()->json($this->cashService->record($store, 'expense', 'out', (float) $data['amount'], $request->user(), null, $data['notes']), 201);
    }
}
