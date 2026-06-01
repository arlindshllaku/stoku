<?php

namespace App\Domain\Purchases\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $storeId = $this->route('store')?->id ?? $this->route('store');
        $inventoryItemId = $this->route('purchase')?->inventory_item_id;

        return [
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('store_id', $storeId)],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'expected_selling_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'incoming_item' => ['required', 'array'],
            'incoming_item.imei' => [
                'nullable',
                'string',
                'max:80',
                Rule::unique('inventory_items', 'imei')->where('store_id', $storeId)->ignore($inventoryItemId),
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
