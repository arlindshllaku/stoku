<?php

namespace App\Domain\Sales\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExchangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'outgoing_item_id' => ['required', 'integer'],
            'customer_id' => ['nullable', 'integer'],
            'cash_difference' => ['nullable', 'numeric', 'min:0'],
            'cash_direction' => ['nullable', 'in:none,customer_pays,store_pays'],
            'estimated_incoming_value' => ['nullable', 'numeric', 'min:0'],
            'outgoing_sale_value' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'incoming_item' => ['required', 'array'],
            'incoming_item.imei' => ['nullable', 'string', 'max:80'],
            'incoming_item.brand' => ['required', 'string', 'max:120'],
            'incoming_item.model' => ['required', 'string', 'max:160'],
            'incoming_item.color' => ['nullable', 'string', 'max:80'],
            'incoming_item.storage' => ['nullable', 'string', 'max:80'],
            'incoming_item.purchase_price' => ['required', 'numeric', 'min:0'],
            'incoming_item.selling_price' => ['required', 'numeric', 'min:0'],
            'incoming_item.notes' => ['nullable', 'string'],
        ];
    }
}
