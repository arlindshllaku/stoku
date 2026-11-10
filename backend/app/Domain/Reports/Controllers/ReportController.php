<?php

namespace App\Domain\Reports\Controllers;

use App\Domain\Reports\Services\ReportService;
use App\Domain\Stores\Models\Store;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    public function __invoke(Request $request, Store $store, string $type, ReportService $reports)
    {
        abort_unless(in_array($type, ReportService::TYPES, true), 404);
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'format' => ['nullable', Rule::in(['xlsx', 'pdf'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $report = $reports->build($store, $type, $data['from'], $data['to']);
        if (isset($data['format'])) {
            $format = $data['format'];

            return response($reports->export($report, $format))->header('Content-Type', $format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                ->header('Content-Disposition', 'attachment; filename="'.$type.'-'.$data['from'].'.'.$format.'"');
        }
        $report['total'] = count($report['rows']);
        $report['page'] = $data['page'] ?? 1;
        $report['last_page'] = max(1, (int) ceil($report['total'] / 50));
        $report['rows'] = array_slice($report['rows'], ($report['page'] - 1) * 50, 50);

        return response()->json($report);
    }
}
