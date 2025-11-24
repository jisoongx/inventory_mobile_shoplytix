<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

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

    public function updateOwner(Request $request)
    {
        $validated = $request->validate([
            'firstname' => 'required|string|max:255',
            'middlename' => 'nullable|string|max:255',
            'lastname' => 'required|string|max:255',
            'contact' => 'required|string|max:15',
            'store_name' => 'required|string|max:255',
            'store_address' => 'required|string|max:255',
        ]);

        $email = $request->input('email');

        if (!$email) {
            return response()->json([
                'success' => false,
                'message' => 'Email is required.'
            ], 400);
        }

        // Update the owner data in the database
        $owner = DB::table('owners')->where('email', $email)->first();

        if (!$owner) {
            return response()->json([
                'success' => false,
                'message' => 'Owner not found.'
            ], 404);
        }

        // Update owner details
        DB::table('owners')
            ->where('email', $email)
            ->update([
                'firstname' => $validated['firstname'],
                'middlename' => $validated['middlename'],
                'lastname' => $validated['lastname'],
                'contact' => $validated['contact'],
                'store_name' => $validated['store_name'],
                'store_address' => $validated['store_address'],
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.'
        ], 200);
    }

   
    public function verifyCurrentPassword(Request $request)
{
    $validated = $request->validate([
        'current_password' => 'required|string',
    ]);

    $email = $request->input('email');
    $currentPassword = $request->input('current_password');

    // Fetch the owner by email
    $owner = DB::table('owners')->where('email', $email)->first();

    if (!$owner) {
        return response()->json([
            'success' => false,
            'message' => 'Owner not found.'
        ], 404);
    }

    // Check if the current password matches
    if (!password_verify($currentPassword, $owner->owner_pass)) {
        return response()->json([
            'success' => false,
            'message' => 'Current password is incorrect.'
        ], 400);
    }

    return response()->json([
        'success' => true,
        'message' => 'Current password is correct.'
    ], 200);
}

    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $email = $request->input('email');
        $currentPassword = $request->input('current_password');

        $owner = DB::table('owners')->where('email', $email)->first();

        if (!$owner) {
            return response()->json([
                'success' => false,
                'message' => 'Owner not found.'
            ], 404);
        }

        if (!password_verify($currentPassword, $owner->owner_pass)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect.'
            ], 400);
        }

        DB::table('owners')->where('email', $email)->update([
            'owner_pass' => bcrypt($request->new_password),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully.'
        ], 200);
    }


    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $owner = DB::table('owners')->where('email', $request->email)->first();

        if (!$owner) {
            return response()->json(['success' => false, 'message' => 'Email not found.']);
        }

        // Generate a 6-digit numeric token
        $token = rand(100000, 999999);
        $expires = Carbon::now()->addMinutes(15); // shorter expiration for security

        DB::table('owners')
            ->where('owner_id', $owner->owner_id)
            ->update([
                'reset_token' => $token,
                'reset_token_expires_at' => $expires,
            ]);

        try {
            $messageText =
                "Your ShopLytix password reset code is: {$token}\n\n" .
                "Enter this code in the ShopLytix mobile app to reset your password.\n" .
                "This code will expire in 15 minutes.";

            Mail::raw($messageText, function ($message) use ($owner) {
                $message->to($owner->email)
                    ->subject('ShopLytix Password Reset Code');
            });

            return response()->json([
                'success' => true,
                'message' => 'Reset code sent to your email.'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to send email: ' . $e->getMessage()
            ]);
        }
    }




    public function resetPassword(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'token' => 'required', // numeric reset code
                'password' => 'required|min:8|confirmed',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Return JSON if validation fails
            return response()->json([
                'success' => false,
                'message' => $e->errors(), // returns validation errors
            ], 422);
        }

        $owner = DB::table('owners')
            ->where('email', $request->email)
            ->where('reset_token', $request->token)
            ->first();

        if (!$owner) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid code or email.'
            ]);
        }

        if (Carbon::parse($owner->reset_token_expires_at)->isPast()) {
            return response()->json([
                'success' => false,
                'message' => 'Code expired.'
            ]);
        }

        DB::table('owners')
            ->where('owner_id', $owner->owner_id)
            ->update([
                'owner_pass' => bcrypt($request->password),
                'reset_token' => null,
                'reset_token_expires_at' => null,
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully.'
        ]);
    }
}
