<?php

namespace App\Domain\Reports\Models;

use Illuminate\Database\Eloquent\Model;

class StoreMailSetting extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return ['password' => 'encrypted'];
    }
}
