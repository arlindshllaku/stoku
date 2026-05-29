<?php

namespace App\Domain\Sales\Requests;

use Illuminate\Foundation\Http\FormRequest;

class NormalSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'inventory_item_id' => ['required', 'integer'],
            'customer_id' => ['nullable', 'integer'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'in:cash,card,mixed,other'],
        ];
    }
}
