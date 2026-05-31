<?php

namespace App\Domain\Reports\Controllers;

use App\Domain\Sales\Models\Sale;
use App\Domain\Stores\Models\Store;
use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SalesReportController extends Controller
{
    public function __invoke(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['daily', 'weekly', 'monthly', 'custom'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        [$from, $to] = $this->range($data['period'] ?? 'daily', $data['from'] ?? null, $data['to'] ?? null);

        $sales = Sale::query()
            ->where('store_id', $store->id)
            ->whereBetween('created_at', [$from, $to])
            ->with('items')
            ->latest('created_at')
            ->get();

        return response()->json([
            'data' => $sales,
            'summary' => [
                'from' => $from->toDateTimeString(),
                'to' => $to->toDateTimeString(),
                'count' => $sales->count(),
                'total' => (float) $sales->sum(fn (Sale $sale) => $sale->total),
                'profit' => (float) $sales->sum(fn (Sale $sale) => $sale->profit),
                'discount' => (float) $sales->sum(fn (Sale $sale) => $sale->discount),
                'items_sold' => (int) $sales->sum(fn (Sale $sale) => $sale->items->sum('quantity')),
            ],
        ]);
    }

    private function range(string $period, ?string $from, ?string $to): array
    {
        if ($period === 'custom') {
            return [
                Carbon::parse($from ?? today())->startOfDay(),
                Carbon::parse($to ?? $from ?? today())->endOfDay(),
            ];
        }

        $now = now();

        if ($period === 'weekly') {
            return [
                $now->copy()->startOfWeek(),
                $now->copy()->endOfWeek(),
            ];
        }

        if ($period === 'monthly') {
            return [
                $now->copy()->startOfMonth(),
                $now->copy()->endOfMonth(),
            ];
        }

        return [
            $now->copy()->startOfDay(),
            $now->copy()->endOfDay(),
        ];
    }
}
