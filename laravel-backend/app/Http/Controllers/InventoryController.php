<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $owner_id = $request->input('owner_id'); 
        if (!$owner_id) {
            return response()->json(['error' => 'owner_id missing'], 400);
        }
        
        $search   = $request->input('search');
        $category = $request->input('category');
        $status   = $request->input('status', 'active');
        
        DB::statement("SET SESSION sql_mode = REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', '')");
        
        $query = "
            SELECT
                p.prod_code,
                MIN(p.barcode)        AS barcode,
                MIN(p.name)           AS name,
                MIN(p.cost_price)     AS cost_price,
                MIN(p.selling_price)  AS selling_price,
                MIN(p.stock_limit)    AS stock_limit,
                MIN(p.prod_image)     AS prod_image,
                MIN(u.unit)           AS unit,
                p.prod_status,
                COALESCE((
                    SELECT SUM(stock)
                    FROM inventory i
                    WHERE i.prod_code = p.prod_code
                ), 0) AS current_stock
            FROM products p
            JOIN units u ON p.unit_id = u.unit_id
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.owner_id = :owner_id
            AND p.prod_status = :status
        ";
        
        $params = [
            'owner_id' => $owner_id,
            'status'   => $status,
        ];
        
        if (!empty($search)) {
            $query .= "
                AND (LOWER(p.name) LIKE :search_name 
                OR LOWER(p.barcode) LIKE :search_barcode)
            ";
            $params['search_name'] = '%' . strtolower($search) . '%';
            $params['search_barcode'] = '%' . strtolower($search) . '%';
        }
        
        if (!empty($category)) {
            $query .= " AND p.category_id = :category_id";
            $params['category_id'] = $category;
        }
        
        $query .= " GROUP BY p.prod_code, p.prod_status ORDER BY p.prod_code DESC";
        
        $products = DB::select($query, $params);
        
        // Get base URL for images
        $baseUrl = env('APP_API_URL');
        
        $products = array_map(function ($p) use ($baseUrl) {
            $p->cost_price = (float) $p->cost_price;
            $p->selling_price = (float) $p->selling_price;
            $p->stock_limit = (int) $p->stock_limit;
            $p->current_stock = (int) $p->current_stock;
            
             if ($p->prod_image && $p->prod_image !== 'assets/no-product-image.png') {
                $imageName = basename($p->prod_image); 
                $p->prod_image = $baseUrl . '/api/product-image/' . $imageName;
            } else {
                $p->prod_image = null;
            }
            
            return $p;
        }, $products);
        
        return response()->json([
            'success' => true,
            'products' => $products,
            'count' => count($products),
        ]);
    }

    public function getProductImage($filename)
    {
        $fullPath = 'D:/julie/laravel/inven/inventory/public/storage/product_images/' . $filename;

        if (!file_exists($fullPath)) {
            return response()->json(['error' => 'Image not found'], 404);
        }

        return response()->file($fullPath);
    }



}