<?php

namespace App\Domain\Purchases\Models;

use Illuminate\Database\Eloquent\Model;

class Purchase extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'store_id',
        'customer_id',
        'inventory_item_id',
        'purchase_number',
        'purchase_price',
        'expected_selling_price',
        'notes',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'purchase_price' => 'decimal:2',
            'expected_selling_price' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }
}
