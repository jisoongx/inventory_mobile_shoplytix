<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StoreController extends Controller
{

    public function index(Request $request)
    {
        $owner_id = $request->input('owner_id');

        if (!$owner_id) {
            return response()->json([
                'success' => false,
                'message' => 'Owner ID is required.'
            ], 400);
        }

        $owner = DB::table('owners')->where('owner_id', $owner_id)->first();

        if (!$owner) {
            return response()->json([
                'success' => false,
                'message' => 'Owner not found.'
            ], 404);
        }

        $products = DB::select("
            SELECT 
                p.prod_code,
                p.name AS prod_name,
                p.prod_image,
                p.selling_price,
                COALESCE(SUM(i.stock), 0) AS stock
            FROM products p 
            LEFT JOIN inventory i ON p.prod_code = i.prod_code 
            WHERE p.owner_id = ?
            AND p.prod_status = 'active'
            GROUP BY p.prod_code, p.name, p.prod_image, p.selling_price
        ", [$owner_id]);

        $baseUrl = env('APP_API_URL');

        $products = array_map(function ($p) use ($baseUrl) {
            if ($p->prod_image && $p->prod_image !== 'assets/no-product-image.png') {
                $imageName = basename($p->prod_image); 
                $p->prod_image = $baseUrl . '/api/store-image/' . $imageName;
            } else {
                $p->prod_image = null;
            }
            return $p;
        }, $products);

        return response()->json([
            'success' => true,
            'products' => $products,
            'message' => 'Products fetched successfully'
        ]);
    }

    public function checkout(Request $request)
    {
        $owner_id = $request->input('owner_id');
        $amount_paid = $request->input('amount_paid');
        $items = $request->input('items'); 

        // Better validation
        if (!$owner_id) {
            return response()->json([
                'success' => false,
                'message' => 'Owner ID is required.'
            ], 400);
        }

        if (!$amount_paid || $amount_paid <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'Valid amount_paid is required.'
            ], 400);
        }

        if (!$items || !is_array($items) || count($items) === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Items array is required and cannot be empty.'
            ], 400);
        }

        // Validate owner exists
        $owner = DB::table('owners')
            ->where('owner_id', $owner_id)
            ->first();

        if (!$owner) {
            return response()->json([
                'success' => false,
                'message' => 'Owner not found.'
            ], 404);
        }

        DB::beginTransaction();

        try {
            // Validate all products exist before processing
            foreach ($items as $item) {
                if (!isset($item['prod_code']) || !isset($item['quantity'])) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Each item must have prod_code and quantity.'
                    ], 400);
                }

                $product = DB::table('products')
                    ->where('prod_code', $item['prod_code'])
                    ->where('owner_id', $owner_id)
                    ->first();

                if (!$product) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "Product {$item['prod_code']} not found."
                    ], 400);
                }
            }

            // 1. Create Receipt
            $receipt_id = DB::table('receipt')->insertGetId([
                'receipt_date' => now(),
                'owner_id' => $owner_id,
                'amount_paid' => $amount_paid,
                'discount_type' => null,
                'discount_value' => 0
            ]);

            foreach ($items as $item) {
                $prod_code = $item['prod_code'];
                $qtyNeeded = $item['quantity'];

                if ($qtyNeeded <= 0) {
                    continue;
                }

                $inventoryRows = DB::table('inventory')
                    ->where('prod_code', $prod_code)
                    ->where('owner_id', $owner_id)
                    ->where('stock', '>', 0)
                    ->orderBy('expiration_date', 'ASC')
                    ->get();

                $totalAvailable = $inventoryRows->sum('stock');
                
                if ($totalAvailable < $qtyNeeded) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "Not enough stock for product $prod_code. Needed: $qtyNeeded, Available: $totalAvailable"
                    ], 400);
                }

                foreach ($inventoryRows as $inv) {
                    if ($qtyNeeded <= 0) break;

                    $available = $inv->stock;
                    if ($available <= 0) continue;

                    $subtract = min($available, $qtyNeeded);

                    // Deduct stock
                    DB::table('inventory')
                        ->where('inven_code', $inv->inven_code)
                        ->update([
                            'stock' => $available - $subtract
                        ]);

                    // Create receipt_item per inventory row used - ADD prod_code HERE
                    DB::table('receipt_item')->insert([
                        'receipt_id' => $receipt_id,
                        'inven_code' => $inv->inven_code,
                        'prod_code' => $prod_code, // ← THIS IS THE FIX
                        'item_quantity' => $subtract,
                        'vat_amount' => 0,
                        'item_discount_type' => null,
                        'item_discount_value' => 0
                    ]);

                    $qtyNeeded -= $subtract;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Checkout completed successfully.',
                'receipt_id' => $receipt_id
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Checkout failed due to server error.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getProductImage($filename)
    {
        $storagePath = env('PRODUCT_IMAGE_PATH');
        $fullPath = $storagePath . $filename;

        if (!file_exists($fullPath)) {
            return response()->json(['error' => 'Image not found'], 404);
        }

        return response()->file($fullPath);
    }



}
