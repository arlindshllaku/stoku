<?php

namespace App\Domain\Sales\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExchangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $storeId = $this->route('store')?->id ?? $this->route('store');

        return [
            'outgoing_item_id' => [
                'required',
                'integer',
                Rule::exists('inventory_items', 'id')->where(fn ($query) => $query
                    ->where('store_id', $storeId)
                    ->where('status', 'in_stock')),
            ],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('store_id', $storeId)],
            'cash_difference' => ['nullable', 'numeric', 'min:0'],
            'cash_direction' => ['nullable', 'in:none,customer_pays,store_pays'],
            'estimated_incoming_value' => ['nullable', 'numeric', 'min:0'],
            'outgoing_sale_value' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'incoming_item' => ['required', 'array'],
            'incoming_item.imei' => [
                'nullable',
                'string',
                'max:80',
                Rule::unique('inventory_items', 'imei')->where('store_id', $storeId),
            ],
            'incoming_item.brand' => ['required', 'string', 'max:120'],
            'incoming_item.model' => ['required', 'string', 'max:160'],
            'incoming_item.color' => ['nullable', 'string', 'max:80'],
            'incoming_item.storage' => ['nullable', 'string', 'max:80'],
            'incoming_item.purchase_price' => ['nullable', 'numeric', 'min:0'],
            'incoming_item.selling_price' => ['nullable', 'numeric', 'min:0'],
            'incoming_item.notes' => ['nullable', 'string'],
        ];
    }
}
