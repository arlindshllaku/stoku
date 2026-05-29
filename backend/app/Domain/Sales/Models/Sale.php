<?php

namespace App\Domain\Sales\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'store_id',
        'customer_id',
        'sale_number',
        'type',
        'subtotal',
        'discount',
        'total',
        'payment_method',
        'profit',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
            'profit' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }
}
