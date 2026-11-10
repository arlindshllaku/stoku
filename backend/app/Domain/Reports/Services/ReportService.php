<?php

namespace App\Domain\Reports\Services;

use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryMovement;
use App\Domain\Purchases\Models\Purchase;
use App\Domain\Sales\Models\Exchange;
use App\Domain\Sales\Models\Sale;
use App\Domain\Stores\Models\Store;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class ReportService
{
    public const TYPES = ['sales', 'exchanges', 'purchases', 'inventory', 'stock'];

    public function build(Store $store, string $type, string $from, string $to): array
    {
        $zone = $store->timezone ?: 'Europe/Budapest';
        $start = CarbonImmutable::parse($from, $zone)->startOfDay()->utc();
        $end = CarbonImmutable::parse($to, $zone)->endOfDay()->utc();
        $query = match ($type) {
            'sales' => Sale::query()->with('items.inventoryItem')->where('type', 'normal'),
            'exchanges' => Exchange::query()->with(['outgoingItem', 'incomingItem', 'incomingItems.item']),
            'purchases' => Purchase::query()->with('item'),
            'inventory' => InventoryMovement::query()->with('item'),
            'stock' => InventoryItem::query()->whereIn('status', ['in_stock', 'reserved', 'damaged', 'returned']),
            default => throw ValidationException::withMessages(['type' => 'Raport i panjohur.']),
        };
        $query->where('store_id', $store->id);
        if ($type !== 'stock') {
            $query->whereBetween('created_at', [$start, $end]);
        }
        if ((clone $query)->count() > 20000) {
            throw ValidationException::withMessages(['from' => 'Zgjidhni një periudhë më të shkurtër (maksimumi 20 000 regjistrime).']);
        }
        $phone = fn ($item) => $item ? trim($item->brand.' '.$item->model).' | IMEI: '.($item->imei ?: '-') : '-';
        $rows = $query->orderBy('id')->get()->map(function ($record) use ($type, $zone, $phone) {
            $date = CarbonImmutable::parse($record->created_at)->setTimezone($zone)->format('d.m.Y H:i');

            return match ($type) {
                'sales' => [$date, $record->sale_number, $record->items->map(fn ($item) => $phone($item->inventoryItem))->implode('; '), $record->payment_method, (float) $record->total, (float) $record->profit],
                'exchanges' => [$date, $phone($record->outgoingItem), $record->incomingItems->isNotEmpty() ? $record->incomingItems->map(fn ($link) => $phone($link->item))->implode('; ') : $phone($record->incomingItem), (float) $record->estimated_incoming_value, (float) $record->outgoing_sale_value, $record->cash_direction, (float) $record->cash_difference, (float) $record->profit_loss, $record->notes],
                'purchases' => [$date, $record->purchase_number, $phone($record->item), (float) $record->purchase_price, (float) $record->expected_selling_price, $record->notes],
                'inventory' => [$date, $phone($record->item), $record->type, $record->direction, (int) $record->quantity, (float) $record->unit_cost, (float) $record->unit_price, $record->notes],
                'stock' => [$phone($record), $record->color, $record->storage, $record->status, (float) $record->purchase_price, (float) $record->selling_price],
            };
        })->all();
        [$title, $headings, $amountColumn] = match ($type) {
            'sales' => ['Shitjet', ['Data', 'Fatura', 'Telefoni / IMEI', 'Pagesa', 'Totali EUR', 'Fitimi EUR'], 4],
            'exchanges' => ['Ndërrimet', ['Data', 'Telefoni dalës', 'Telefonat hyrës', 'Vlera hyrëse EUR', 'Vlera dalëse EUR', 'Drejtimi cash', 'Cash EUR', 'Fitim/Humbje EUR', 'Shënime'], 7],
            'purchases' => ['Blerjet', ['Data', 'Dokumenti', 'Telefoni / IMEI', 'Paguar EUR', 'Çmimi i synuar EUR', 'Shënime'], 3],
            'inventory' => ['Lëvizjet e inventarit', ['Data', 'Telefoni / IMEI', 'Lëvizja', 'Drejtimi', 'Sasia', 'Kosto EUR', 'Çmimi EUR', 'Shënime'], 5],
            'stock' => ['Stoku aktual', ['Telefoni / IMEI', 'Ngjyra', 'Memoria', 'Statusi', 'Kosto EUR', 'Çmimi EUR'], 4],
        };

        return [
            'title' => $title, 'store' => $store->name, 'type' => $type, 'from' => $from, 'to' => $to,
            'generated_at' => now()->setTimezone($zone)->format('d.m.Y H:i'),
            'headings' => $headings, 'rows' => $rows,
            'summary' => ['count' => count($rows), 'amount' => array_sum(array_column($rows, $amountColumn))],
        ];
    }

    public function export(array $report, string $format): string
    {
        if ($format === 'pdf') {
            $escape = fn ($value) => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $html = '<html lang="sq"><meta charset="utf-8"><style>body{font-family:DejaVu Sans;font-size:9px;color:#172033}h1{font-size:20px}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#e9eef5}td,th{padding:5px;border:1px solid #ddd;word-wrap:break-word}thead{display:table-header-group}</style><h1>'.$escape($report['title']).'</h1><p>'.$escape($report['store']).' | '.$escape($report['from']).' - '.$escape($report['to']).'</p><p>Gjeneruar: '.$escape($report['generated_at']).' | Regjistrime: '.$report['summary']['count'].'</p><table><thead><tr>';
            foreach ($report['headings'] as $heading) {
                $html .= '<th>'.$escape($heading).'</th>';
            }
            $html .= '</tr></thead><tbody>';
            foreach ($report['rows'] as $row) {
                $html .= '<tr>';
                foreach ($row as $value) {
                    $html .= '<td>'.$escape($value).'</td>';
                }
                $html .= '</tr>';
            }

            return Pdf::loadHTML($html.'</tbody></table></html>')->setPaper('a4', 'landscape')->output();
        }
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet();
        foreach ([[$report['title'], $report['store']], [$report['from'], $report['to']], ['Gjeneruar', $report['generated_at']], $report['headings']] as $index => $row) {
            foreach ($row as $column => $value) {
                $sheet->setCellValueExplicit([$column + 1, $index + 1], (string) $value, DataType::TYPE_STRING);
            }
        }
        foreach ($report['rows'] as $index => $row) {
            foreach ($row as $column => $value) {
                $sheet->setCellValueExplicit([$column + 1, $index + 5], $value ?? '', is_numeric($value) && ! is_string($value) ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING);
            }
        }
        $sheet->freezePane('A5');
        $sheet->getStyle('A4:'.$sheet->getHighestColumn().'4')->getFont()->setBold(true);
        foreach ($sheet->getColumnIterator() as $column) {
            $sheet->getColumnDimension($column->getColumnIndex())->setWidth(24);
        }
        $sheet->getStyle($sheet->calculateWorksheetDimension())->getAlignment()->setWrapText(true);
        ob_start();
        try {
            (new Xlsx($book))->save('php://output');

            return ob_get_contents();
        } finally {
            ob_end_clean();
            $book->disconnectWorksheets();
        }
    }
}
