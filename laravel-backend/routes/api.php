<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OwnerController;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

Route::post('/login', [LoginController::class, 'login']);
Route::get('/dashboard', [DashboardController::class, 'index']);

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
    
    // Get unread count (using usernotif_seen)
    $unreadCount = DB::select("
        SELECT COUNT(*) as cnt
        FROM user_notification
        WHERE usernotif_email = ?
        AND usernotif_seen = 0
    ", [$email]);
    
    $count = $unreadCount[0]->cnt ?? 0;
    
    return response()->json([
        'success' => true,
        'notifications' => $notifications,
        'unread_count' => $count
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