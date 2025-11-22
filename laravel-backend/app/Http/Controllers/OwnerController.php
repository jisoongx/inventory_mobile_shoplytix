<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OwnerController extends Controller
{
    public function getOwner(Request $request)
    {
        $email = $request->query('email');

        if (!$email) {
            return response()->json([
                'success' => false,
                'message' => 'Email is required.'
            ], 400);
        }

        // Fetch owner using DB::table instead of model
        $owner = DB::table('owners')   // ← change this to your actual table name
            ->where('email', $email)
            ->first();

        if (!$owner) {
            return response()->json([
                'success' => false,
                'message' => 'Owner not found.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'owner' => $owner
        ], 200);
    }
}
