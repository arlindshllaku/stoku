<?php

use App\Domain\Cash\Controllers\CashController;
use App\Domain\Inventory\Controllers\InventoryController;
use App\Domain\Purchases\Controllers\PurchaseController;
use App\Domain\Sales\Controllers\SalesController;
use App\Domain\Stores\Controllers\StoreController;
use App\Domain\Users\Controllers\AuthController;
use App\Domain\Users\Controllers\StoreUserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::apiResource('stores', StoreController::class);
        Route::patch('/stores/{store}/status', [StoreController::class, 'status']);
        Route::post('/stores/{store}/owners', [StoreController::class, 'assignOwner']);

        Route::prefix('/stores/{store}')
            ->middleware('store.access')
            ->group(function (): void {
                Route::apiResource('inventory', InventoryController::class);
                Route::post('/inventory/{inventory}/adjust', [InventoryController::class, 'adjust']);
                Route::get('/inventory/{inventory}/movements', [InventoryController::class, 'movements']);

                Route::post('/sales/normal', [SalesController::class, 'normal']);
                Route::post('/sales/exchange', [SalesController::class, 'exchange']);
                Route::get('/sales', [SalesController::class, 'index']);

                Route::get('/purchases', [PurchaseController::class, 'index']);
                Route::post('/purchases', [PurchaseController::class, 'store']);

                Route::get('/cash', [CashController::class, 'show']);
                Route::post('/cash/deposit', [CashController::class, 'deposit']);
                Route::post('/cash/withdraw', [CashController::class, 'withdraw']);
                Route::post('/cash/expense', [CashController::class, 'expense']);

                Route::get('/users', [StoreUserController::class, 'index']);
                Route::post('/users', [StoreUserController::class, 'store']);
                Route::patch('/users/{user}/status', [StoreUserController::class, 'status']);
            });
    });
});
