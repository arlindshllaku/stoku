<?php

namespace App\Domain\Purchases\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'expected_selling_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'incoming_item' => ['required', 'array'],
            'incoming_item.imei' => ['nullable', 'string', 'max:80'],
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
