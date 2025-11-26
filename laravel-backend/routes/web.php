<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Response;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/image/{filename}', function ($filename) {
    $path = storage_path('app/public/product_images/' . $filename);
    
    if (!file_exists($path)) {
        abort(404, "File not found at: " . $path);
    }

    $file = file_get_contents($path);
    $type = mime_content_type($path);

    return Response::make($file, 200)->header("Content-Type", $type);
});