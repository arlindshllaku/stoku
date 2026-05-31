<?php

namespace App\Domain\Sales\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class NormalSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $storeId = $this->route('store')?->id ?? $this->route('store');

        return [
            'inventory_item_id' => [
                'required',
                'integer',
                Rule::exists('inventory_items', 'id')->where(fn ($query) => $query
                    ->where('store_id', $storeId)
                    ->where('status', 'in_stock')),
            ],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('store_id', $storeId)],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'in:cash,card,mixed,other'],
        ];
    }
}
