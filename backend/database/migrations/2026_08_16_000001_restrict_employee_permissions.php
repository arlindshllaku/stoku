<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->updateOrInsert(
            ['name' => 'sales.view'],
            ['description' => null, 'updated_at' => now(), 'created_at' => now()],
        );

        $permissions = DB::table('permissions')->pluck('id', 'name');
        $roles = DB::table('roles')->pluck('id', 'name');

        $this->grantPermissions($roles->get('super_admin'), $permissions->keys()->all(), $permissions);
        $this->grantPermissions(
            $roles->get('store_owner'),
            $permissions->keys()->reject(fn (string $name) => $name === 'stores.manage')->all(),
            $permissions,
        );

        $employeeRoleId = DB::table('roles')
            ->where('name', 'employee')
            ->where('scope', 'store')
            ->value('id');

        if (! $employeeRoleId) {
            return;
        }

        DB::table('role_permissions')->where('role_id', $employeeRoleId)->delete();
        $this->grantPermissions($employeeRoleId, ['inventory.view', 'sales.view', 'cash.view'], $permissions);
    }

    public function down(): void
    {
        $permissions = DB::table('permissions')->pluck('id', 'name');
        $employeeRoleId = DB::table('roles')
            ->where('name', 'employee')
            ->where('scope', 'store')
            ->value('id');

        if ($employeeRoleId) {
            DB::table('role_permissions')->where('role_id', $employeeRoleId)->delete();
            $this->grantPermissions($employeeRoleId, ['inventory.view', 'inventory.create', 'sales.create', 'cash.view'], $permissions);
        }
    }

    private function grantPermissions(?int $roleId, array $permissionNames, $permissions): void
    {
        if (! $roleId) {
            return;
        }

        foreach ($permissionNames as $permissionName) {
            $permissionId = $permissions->get($permissionName);

            if (! $permissionId) {
                continue;
            }

            DB::table('role_permissions')->insertOrIgnore([
                'role_id' => $roleId,
                'permission_id' => $permissionId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};
