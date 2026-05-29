<?php

namespace App\Domain\Stores\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPlatformRole('super_admin') === true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180', 'alpha_dash', Rule::unique('stores', 'slug')->ignore($this->route('store')?->id)],
            'address' => ['nullable', 'string'],
            'phone' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:180'],
            'currency' => ['nullable', 'string', 'size:3'],
            'timezone' => ['nullable', 'timezone'],
        ];
    }
}
