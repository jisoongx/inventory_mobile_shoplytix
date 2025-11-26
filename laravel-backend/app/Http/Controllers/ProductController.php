<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;

class ProductController extends Controller
{
    public function index()
    {
        $products = Product::all();
        
        // Transform the data to include full image URL
        $products = $products->map(function ($product) {
            $product->image_url = url('/image/' . $product->image_path);
            return $product;
        });

        return response()->json($products);
    }

    public function show($id)
    {
        $product = Product::findOrFail($id);
        
        // Add full image URL
        $product->image_url = url('/image/' . $product->image_path);

        return response()->json($product);
    }
}