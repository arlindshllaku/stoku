<?php

use App\Domain\Cash\Controllers\CashController;
use App\Domain\Inventory\Controllers\InventoryController;
use App\Domain\Purchases\Controllers\PurchaseController;
use App\Domain\Reports\Controllers\SalesReportController;
use App\Domain\Sales\Controllers\SalesController;
use App\Domain\Stores\Controllers\StoreController;
use App\Domain\Users\Controllers\AuthController;
use App\Domain\Users\Controllers\StoreUserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware(['auth:sanctum', 'active.user'])->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::get('/stores', [StoreController::class, 'index']);
        Route::post('/stores', [StoreController::class, 'store'])->middleware('permission:stores.manage');
        Route::get('/stores/{store}', [StoreController::class, 'show'])->middleware('store.access');
        Route::match(['put', 'patch'], '/stores/{store}', [StoreController::class, 'update'])->middleware('permission:stores.manage');
        Route::delete('/stores/{store}', [StoreController::class, 'destroy'])->middleware('permission:stores.manage');
        Route::patch('/stores/{store}/status', [StoreController::class, 'status'])->middleware('permission:stores.manage');
        Route::post('/stores/{store}/owners', [StoreController::class, 'assignOwner'])->middleware('permission:stores.manage');

        Route::prefix('/stores/{store}')
            ->middleware('store.access')
            ->group(function (): void {
                Route::get('/inventory', [InventoryController::class, 'index'])->middleware('permission:inventory.view');
                Route::post('/inventory', [InventoryController::class, 'store'])->middleware('permission:inventory.create');
                Route::get('/inventory/{inventory}', [InventoryController::class, 'show'])->middleware('permission:inventory.view');
                Route::match(['put', 'patch'], '/inventory/{inventory}', [InventoryController::class, 'update'])->middleware('permission:inventory.update');
                Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy'])->middleware('permission:inventory.adjust');
                Route::post('/inventory/{inventory}/adjust', [InventoryController::class, 'adjust'])->middleware('permission:inventory.adjust');
                Route::get('/inventory/{inventory}/movements', [InventoryController::class, 'movements'])->middleware('permission:inventory.view');

                Route::post('/sales/normal', [SalesController::class, 'normal'])->middleware('permission:sales.create');
                Route::post('/sales/exchange', [SalesController::class, 'exchange'])->middleware('permission:sales.create');
                Route::get('/sales', [SalesController::class, 'index'])->middleware('permission:sales.create');
                Route::put('/sales/{sale}', [SalesController::class, 'update'])->middleware('permission:stores.manage');
                Route::delete('/sales/{sale}', [SalesController::class, 'destroy'])->middleware('permission:stores.manage');
                Route::get('/exchanges', [SalesController::class, 'exchanges'])->middleware('permission:sales.create');

                Route::get('/purchases', [PurchaseController::class, 'index'])->middleware('permission:inventory.view');
                Route::post('/purchases', [PurchaseController::class, 'store'])->middleware('permission:inventory.create');
                Route::put('/purchases/{purchase}', [PurchaseController::class, 'update'])->middleware('permission:stores.manage');
                Route::delete('/purchases/{purchase}', [PurchaseController::class, 'destroy'])->middleware('permission:stores.manage');

                Route::get('/cash', [CashController::class, 'show'])->middleware('permission:cash.view');
                Route::post('/cash/deposit', [CashController::class, 'deposit'])->middleware('permission:cash.adjust');
                Route::post('/cash/withdraw', [CashController::class, 'withdraw'])->middleware('permission:cash.adjust');
                Route::post('/cash/expense', [CashController::class, 'expense'])->middleware('permission:cash.adjust');
                Route::get('/reports/sales', SalesReportController::class)->middleware('permission:reports.export');

                Route::get('/users', [StoreUserController::class, 'index'])->middleware('permission:users.manage');
                Route::post('/users', [StoreUserController::class, 'store'])->middleware('permission:users.manage');
                Route::put('/users/{user}', [StoreUserController::class, 'update'])->middleware('permission:users.manage');
                Route::patch('/users/{user}/status', [StoreUserController::class, 'status'])->middleware('permission:users.manage');
                Route::delete('/users/{user}', [StoreUserController::class, 'destroy'])->middleware('permission:users.manage');
            });
    });
});
