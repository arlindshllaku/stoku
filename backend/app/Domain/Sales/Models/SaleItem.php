<?php

namespace App\Domain\Sales\Models;

use Illuminate\Database\Eloquent\Model;

class SaleItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'sale_id',
        'inventory_item_id',
        'description',
        'quantity',
        'unit_price',
        'unit_cost',
        'profit',
    ];
}
