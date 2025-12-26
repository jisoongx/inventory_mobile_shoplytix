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
        
        try {
            // Disable ONLY_FULL_GROUP_BY for this query
            DB::statement("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))");
            
            $query = "
                SELECT
                    p.prod_code,
                    p.barcode,
                    p.name,
                    p.cost_price,
                    p.selling_price,
                    p.stock_limit,
                    p.prod_image,
                    u.unit,
                    c.category AS category_name,
                    p.category_id,
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
            
            $query .= " ORDER BY p.prod_code DESC";
            
            $products = DB::select($query, $params);
            
            // Get base URL for images
            $baseUrl = env('APP_API_URL', 'http://192.168.254.101:8000');
            
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
            
        } catch (\Exception $e) {
            Log::error('Inventory fetch error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch inventory',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function getCategories(Request $request)
    {
        $owner_id = $request->input('owner_id');
        if (!$owner_id) {
            return response()->json(['error' => 'owner_id missing'], 400);
        }

        try {
            // Changed category_name to category
            $categories = DB::select("
                SELECT category_id, category AS category_name
                FROM categories
                WHERE owner_id = :owner_id
                ORDER BY category ASC
            ", ['owner_id' => $owner_id]);

            return response()->json([
                'success' => true,
                'categories' => $categories,
            ]);
            
        } catch (\Exception $e) {
            Log::error('Categories fetch error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Failed to fetch categories',
                'message' => $e->getMessage()
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