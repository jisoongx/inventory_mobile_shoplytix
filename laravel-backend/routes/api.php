<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OwnerController;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\CategorySalesController;
use App\Http\Controllers\ProductSalesController;



Route::post('/login', [LoginController::class, 'login']);
Route::get('/dashboard', [DashboardController::class, 'index']);
Route::get('/dashboard-image/{filename}', [DashboardController::class, 'getProductImage']);


Route::get('/inventory', [InventoryController::class, 'index']);
Route::get('/product-image/{filename}', [InventoryController::class, 'getProductImage']);
Route::get('/inventory/categories', [InventoryController::class, 'getCategories']);


Route::get('/products', [StoreController::class, 'index']);
Route::post('/store/checkout', [StoreController::class, 'checkout']);
Route::get('/store-image/{filename}', [StoreController::class, 'getProductImage']);


Route::post('/category-sales', [CategorySalesController::class, 'categorySales']);
Route::post('/prod-performance', [ProductSalesController::class, 'prodPerformance']);


Route::get('/notifications', function (Request $request) {
    $email = $request->query('email');
    $filter = $request->query('filter', 'all'); // Default to 'all'
    
    if (!$email) {
        return response()->json([
            'success' => false,
            'message' => 'Email is required'
        ], 400);
    }
    
    // Fetch notifications based on filter
    if ($filter === 'all') {
        $notifications = DB::select("
            SELECT n.notif_id, n.notif_title, n.notif_message, n.notif_created_on, 
                   un.usernotif_is_read, n.notif_type
            FROM notification n
            JOIN user_notification un ON n.notif_id = un.notif_id
            WHERE un.usernotif_email = ?
            ORDER BY n.notif_created_on DESC
        ", [$email]);
    } else if ($filter === 'unread') {
        $notifications = DB::select("
            SELECT n.notif_id, n.notif_title, n.notif_message, n.notif_created_on, 
                   un.usernotif_is_read, n.notif_type
            FROM notification n
            JOIN user_notification un ON n.notif_id = un.notif_id
            WHERE un.usernotif_email = ?
            AND un.usernotif_is_read = 0
            ORDER BY n.notif_created_on DESC
        ", [$email]);
    }
    
    $unreadCount = DB::select("
        SELECT COUNT(*) as cnt
        FROM user_notification
        WHERE usernotif_email = ?
        AND usernotif_is_read = 0
    ", [$email]);

    $unseenCount = DB::select("
        SELECT COUNT(*) as cnt
        FROM user_notification
        WHERE usernotif_email = ?
        AND usernotif_seen = 0
    ", [$email]);
    
    $count = $unseenCount[0]->cnt ?? 0;
    $countRead = $unreadCount[0]->cnt ?? 0;
    
    return response()->json([
        'success' => true,
        'notifications' => $notifications,
        'unseen_count' => $count,
        'unread_count' => $countRead
    ]);
});

// Optional: Mark notification as read
Route::post('/notifications/{id}/read', function ($id, Request $request) {
    $email = $request->input('email');
    
    if (!$email) {
        return response()->json([
            'success' => false,
            'message' => 'Email is required'
        ], 400);
    }
    
    DB::table('user_notification')
        ->where('notif_id', $id)
        ->where('usernotif_email', $email)
        ->update([
            'usernotif_is_read' => 1,
            'usernotif_seen' => 1
        ]);
    
    return response()->json([
        'success' => true,
        'message' => 'Notification marked as read'
    ]);
});

Route::post('/notifications/bell-clicked', function (Request $request) {
    $email = $request->input('email');

    if (!$email) {
        return response()->json([
            'success' => false,
            'message' => 'Email is required'
        ], 400);
    }

    // Update all unseen notifications for this user
    DB::update("
        UPDATE user_notification
        SET usernotif_seen = 1
        WHERE usernotif_email = ?
        AND usernotif_seen = 0
    ", [$email]);

    return response()->json([
        'success' => true,
        'message' => 'All notifications marked as seen'
    ]);
});

// Optional: Mark all as seen (for clearing notification badge)
Route::post('/notifications/mark-seen', function (Request $request) {
    $email = $request->input('email');
    
    if (!$email) {
        return response()->json([
            'success' => false,
            'message' => 'Email is required'
        ], 400);
    }
    
    DB::table('user_notification')
        ->where('usernotif_email', $email)
        ->update(['usernotif_seen' => 1]);
    
    return response()->json([
        'success' => true,
        'message' => 'All notifications marked as seen'
    ]);
});



Route::get('/owner', [OwnerController::class, 'getOwner']);
Route::put('/owner/update', [OwnerController::class, 'updateOwner']);

Route::post('/owner/change-password', [OwnerController::class, 'changePassword']);
Route::post('/owner/verify-current-password', [OwnerController::class, 'verifyCurrentPassword']);
// routes/api.php
Route::post('/forgot-password', [OwnerController::class, 'forgotPassword']);

Route::post('/reset-password', [OwnerController::class, 'resetPassword']);



Route::get('/products', [StoreController::class, 'index']);
Route::post('/store/checkout', [StoreController::class, 'checkout']);
Route::get('/store-image/{filename}', [StoreController::class, 'getProductImage']);