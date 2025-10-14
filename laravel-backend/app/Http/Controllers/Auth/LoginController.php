<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class LoginController extends Controller
{
    public function login(Request $request)
    {
        // Validate input
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string|min:6',
        ]);

        // Get owner from DB manually
        $owner = DB::table('owners')
            ->where('email', $request->email)
            ->first();

        if (!$owner) {
            return response()->json([
                'success' => false,
                'message' => 'Email not found.',
            ], 404);
        }

        // ✅ Compare hashed password manually
        if (!Hash::check($request->password, $owner->owner_pass)) {
            return response()->json([
                'success' => false,
                'message' => 'Incorrect password.',
            ], 401);
        }

        // ✅ Login successful
        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'owner_id' => $owner->owner_id,
            'owner_email' => $owner->email,
            'owner_name' => $owner->firstname,
        ]);
    }
}
