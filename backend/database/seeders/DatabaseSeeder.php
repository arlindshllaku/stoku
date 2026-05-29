<?php

namespace Database\Seeders;

use App\Domain\Users\Models\Permission;
use App\Domain\Users\Models\Role;
use App\Domain\Cash\Models\CashRegister;
use App\Domain\Stores\Models\Store;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = collect([
            'stores.manage',
            'inventory.view',
            'inventory.create',
            'inventory.update',
            'inventory.adjust',
            'sales.create',
            'cash.view',
            'cash.adjust',
            'reports.export',
            'users.manage',
            'audit.view',
        ])->mapWithKeys(fn (string $name) => [$name => Permission::firstOrCreate(['name' => $name])]);

        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'scope' => 'platform']);
        $storeOwner = Role::firstOrCreate(['name' => 'store_owner', 'scope' => 'store']);
        $employee = Role::firstOrCreate(['name' => 'employee', 'scope' => 'store']);

        $superAdmin->permissions()->sync($permissions->pluck('id'));
        $storeOwner->permissions()->sync($permissions->except(['stores.manage'])->pluck('id'));
        $employee->permissions()->sync($permissions->only(['inventory.view', 'inventory.create', 'sales.create', 'cash.view'])->pluck('id'));

        $admin = User::firstOrCreate(
            ['email' => env('SUPER_ADMIN_EMAIL', 'admin@example.com')],
            [
                'name' => 'Platform Admin',
                'password' => env('SUPER_ADMIN_PASSWORD', 'change-me-now'),
                'status' => 'active',
            ],
        );

        $admin->roles()->syncWithoutDetaching([$superAdmin->id => ['store_id' => null]]);

        $store = Store::firstOrCreate(
            ['slug' => 'dyqani-qendror'],
            [
                'name' => 'Dyqani Qendror',
                'status' => 'active',
                'currency' => 'EUR',
                'timezone' => 'Europe/Budapest',
                'created_by' => $admin->id,
            ],
        );

        $store->users()->syncWithoutDetaching([$admin->id => ['status' => 'active']]);
        $admin->roles()->syncWithoutDetaching([$storeOwner->id => ['store_id' => $store->id]]);

        CashRegister::firstOrCreate(
            ['store_id' => $store->id],
            ['current_balance' => 0, 'opening_balance' => 0],
        );
    }
}
