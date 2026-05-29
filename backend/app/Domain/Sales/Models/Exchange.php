<?php

namespace App\Domain\Sales\Models;

use Illuminate\Database\Eloquent\Model;

class Exchange extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'store_id',
        'customer_id',
        'outgoing_item_id',
        'incoming_item_id',
        'cash_difference',
        'cash_direction',
        'estimated_incoming_value',
        'outgoing_sale_value',
        'profit_loss',
        'notes',
        'created_by',
        'created_at',
    ];
}
