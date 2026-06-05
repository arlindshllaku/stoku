<?php

namespace App\Domain\Sales\Requests;

use App\Domain\Sales\Models\Exchange;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExchangeUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $storeId = $this->route('store')?->id ?? $this->route('store');
        /** @var Exchange $exchange */
        $exchange = $this->route('exchange');
        $incomingIds = $exchange->incomingItems()->pluck('inventory_item_id');

        if ($exchange->incoming_item_id && ! $incomingIds->contains($exchange->incoming_item_id)) {
            $incomingIds->push($exchange->incoming_item_id);
        }

        $rules = [
            'outgoing_item_id' => [
                'required',
                'integer',
                Rule::notIn($incomingIds->all()),
                Rule::exists('inventory_items', 'id')->where(fn ($query) => $query
                    ->where('store_id', $storeId)
                    ->where(fn ($statusQuery) => $statusQuery
                        ->where('status', 'in_stock')
                        ->orWhere('id', $exchange->outgoing_item_id))),
            ],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('store_id', $storeId)],
            'cash_difference' => ['nullable', 'numeric', 'min:0'],
            'cash_direction' => ['nullable', 'in:none,customer_pays,store_pays'],
            'estimated_incoming_value' => ['nullable', 'numeric', 'min:0'],
            'outgoing_sale_value' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'incoming_items' => ['required', 'array', 'min:1', 'max:2'],
            'incoming_items.*.id' => [
                'nullable',
                'integer',
                'distinct',
                Rule::exists('inventory_items', 'id')->where(fn ($query) => $query
                    ->where('store_id', $storeId)
                    ->whereIn('id', $incomingIds->all())),
            ],
            'incoming_items.*.brand' => ['required', 'string', 'max:120'],
            'incoming_items.*.model' => ['required', 'string', 'max:160'],
            'incoming_items.*.color' => ['nullable', 'string', 'max:80'],
            'incoming_items.*.storage' => ['nullable', 'string', 'max:80'],
            'incoming_items.*.purchase_price' => ['nullable', 'numeric', 'min:0'],
            'incoming_items.*.selling_price' => ['nullable', 'numeric', 'min:0'],
            'incoming_items.*.notes' => ['nullable', 'string'],
        ];

        foreach ($this->input('incoming_items', []) as $index => $incomingItem) {
            $rules["incoming_items.$index.imei"] = [
                'nullable',
                'string',
                'max:80',
                'distinct',
                Rule::unique('inventory_items', 'imei')
                    ->where('store_id', $storeId)
                    ->ignore($incomingItem['id'] ?? null),
            ];
        }

        return $rules;
    }
}
