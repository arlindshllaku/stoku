<?php

namespace App\Domain\Inventory\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InventoryItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $storeId = $this->route('store')?->id ?? $this->route('store');
        $itemId = $this->route('inventory')?->id;

        return [
            'category_id' => ['nullable', 'integer'],
            'supplier_id' => ['nullable', 'integer'],
            'imei' => [
                'nullable',
                'string',
                'max:80',
                Rule::unique('inventory_items', 'imei')->where('store_id', $storeId)->ignore($itemId),
            ],
            'brand' => ['required', 'string', 'max:120'],
            'model' => ['required', 'string', 'max:160'],
            'color' => ['nullable', 'string', 'max:80'],
            'storage' => ['nullable', 'string', 'max:80'],
            'purchase_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:in_stock,sold,exchanged_out,reserved,damaged,returned'],
            'date_added' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
