<?php

namespace App\Domain\Cash\Models;

use Illuminate\Database\Eloquent\Model;

class CashTransaction extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'store_id',
        'cash_register_id',
        'type',
        'direction',
        'amount',
        'balance_after',
        'reference_type',
        'reference_id',
        'notes',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'balance_after' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }
}
