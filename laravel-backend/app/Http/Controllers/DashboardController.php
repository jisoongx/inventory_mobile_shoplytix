<?php

// app/Http/Controllers/DashboardController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        // Simply get owner_id from request ssaa
        $owner_id = $request->input('owner_id');

        if (!$owner_id) {
            return response()->json([
                'success' => false,
                'message' => 'Owner ID is required.'
            ], 400);
        }

        $owner = DB::table('owners')
            ->where('owner_id', $owner_id)
            ->first();

        if (!$owner) {
            return response()->json([
                'success' => false,
                'message' => 'Owner not found.'
            ], 404);
        }

        $owner_name = $owner->firstname;
        $owner_email = $owner->email;
        $latestYear = now()->year;
        $currentMonth = (int) date('n');
        $day = now()->format('Y-m-d');

        $selectedYear = $request->input('year');
        $latestYear = now()->year;
        $yearToUse = $selectedYear ?? $latestYear;

        $year = collect(DB::select("
            SELECT DISTINCT YEAR(expense_created) AS year
            FROM expenses
            WHERE expense_created IS NOT NULL and owner_id = ?
            ORDER BY year DESC
        ", [$owner_id]))->pluck('year')->toArray();
        
        
        $currentMonth = (int)date('n');
        $months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        $tableMonths = range(0, ($currentMonth - 1));
        $tableMonthNames = array_slice($months, 0, $currentMonth);

        if (is_null($selectedYear)) {
            $months = array_slice($months, 0, $currentMonth);
            $allMonths = range(0, ($currentMonth - 1));
        } elseif ($selectedYear == $latestYear) {
            $months = array_slice($months, 0, $currentMonth);
            $allMonths = range(0, ($currentMonth - 1));
        } else {
            $allMonths = range(0, 11);
        }
        

        $netProfits = []; //compatative analysis - latest nga year
        $profits = [];  //sa graph ni

        $expenses = collect(DB::select("
            SELECT 
                m.month,
                IFNULL(e.expense_total, 0) AS expense_total
            FROM (
                SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
                SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION
                SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
            ) m
            LEFT JOIN (
                SELECT 
                    MONTH(expense_created) AS month,
                    SUM(expense_amount) AS expense_total
                FROM expenses
                WHERE YEAR(expense_created) = ? AND owner_id = ?
                GROUP BY MONTH(expense_created)
            ) e ON m.month = e.month
            ORDER BY m.month
        ", [$latestYear, $owner_id]))->pluck('expense_total')->slice(0, $currentMonth)->toArray();

        $losses = collect(DB::select("
            SELECT 
                m.month,
                IFNULL(l.total_loss, 0) AS total_loss
            FROM (
                SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
                SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION
                SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
            ) m
            LEFT JOIN (
                SELECT 
                    MONTH(d.damaged_date) AS month,
                    SUM(d.damaged_quantity * p.selling_price) AS total_loss
                FROM damaged_items d
                Join inventory i on i.inven_code = d.inven_code
                JOIN products p ON i.prod_code = p.prod_code
                WHERE d.owner_id = ? AND YEAR(d.damaged_date) = ?
                GROUP BY MONTH(d.damaged_date)
            ) l ON m.month = l.month
            ORDER BY m.month
        ", [$owner_id, $latestYear]))->pluck('total_loss')->slice(0, $currentMonth)->toArray();
     
        $sales = collect(DB::select("
            SELECT 
                m.month,
                IFNULL(s.monthly_sales, 0) AS monthly_sales
            FROM (
                SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
                SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION
                SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
            ) m
            LEFT JOIN (
                SELECT 
                    MONTH(r.receipt_date) AS month,
                    SUM(p.selling_price * ri.item_quantity) AS monthly_sales
                FROM 
                    receipt r
                JOIN receipt_item ri ON ri.receipt_id = r.receipt_id
                JOIN products p ON p.prod_code = ri.prod_code
                WHERE 
                    r.owner_id = ? AND
                    p.owner_id = r.owner_id AND
                    YEAR(r.receipt_date) = ?
                GROUP BY MONTH(r.receipt_date)
            ) s ON m.month = s.month
            ORDER BY m.month
        ", [$owner_id, $latestYear]))->pluck('monthly_sales')->slice(0, $currentMonth)->toArray();

        foreach ($tableMonths as $month) {
            $sale     = $sales[$month]    ?? null;
            $expense  = $expenses[$month] ?? null;
            $loss     = $losses[$month]   ?? null;

            $netProfits[$month] = $sale - ($expense + $loss);
        }

        $GraphExpenses = collect(DB::select("
            SELECT 
                m.month,
                IFNULL(e.expense_total, 0) AS expense_total
            FROM (
                SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
                SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION
                SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
            ) m
            LEFT JOIN (
                SELECT 
                    MONTH(expense_created) AS month,
                    SUM(expense_amount) AS expense_total
                FROM expenses
                WHERE YEAR(expense_created) = ? AND owner_id = ?
                GROUP BY MONTH(expense_created)
            ) e ON m.month = e.month
            ORDER BY m.month
        ", [$yearToUse, $owner_id]))->pluck('expense_total')->toArray();

        $GraphLosses = collect(DB::select("
            SELECT 
                m.month,
                IFNULL(l.total_loss, 0) AS total_loss
            FROM (
                SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
                SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION
                SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
            ) m
            LEFT JOIN (
                SELECT 
                    MONTH(d.damaged_date) AS month,
                    SUM(d.damaged_quantity * p.selling_price) AS total_loss
                FROM damaged_items d
                Join inventory i on i.inven_code = d.inven_code
                JOIN products p ON i.prod_code = p.prod_code
                WHERE d.owner_id = ? AND YEAR(d.damaged_date) = ?
                GROUP BY MONTH(d.damaged_date)
            ) l ON m.month = l.month
            ORDER BY m.month
        ", [$owner_id, $yearToUse]))->pluck('total_loss')->toArray();
     
        $GraphSales = collect(DB::select("
            SELECT 
                m.month,
                IFNULL(s.monthly_sales, 0) AS monthly_sales
            FROM (
                SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
                SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION
                SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
            ) m
            LEFT JOIN (
                SELECT 
                    MONTH(r.receipt_date) AS month,
                    SUM(p.selling_price * ri.item_quantity) AS monthly_sales
                FROM 
                    receipt r
                JOIN receipt_item ri ON ri.receipt_id = r.receipt_id
                JOIN products p ON p.prod_code = ri.prod_code
                WHERE 
                    r.owner_id = ? AND
                    p.owner_id = r.owner_id AND
                    YEAR(r.receipt_date) = ?
                GROUP BY MONTH(r.receipt_date)
            ) s ON m.month = s.month
            ORDER BY m.month
        ", [$owner_id, $yearToUse]))->pluck('monthly_sales')->toArray();

        foreach ($allMonths as $month) {
            $Gsale     = $GraphSales[$month]    ?? null;
            $Gexpense  = $GraphExpenses[$month] ?? null;
            $Gloss     = $GraphLosses[$month]   ?? null;

            $profits[$month] = $Gsale - ($Gexpense + $Gloss);
        }


        $profitMonth = $netProfits[$currentMonth - 1] ?? 0;


        $dailySales = collect(DB::select('
            SELECT IFNULL(SUM(p.selling_price * ri.item_quantity), 0) AS dailySales
            FROM receipt r
            JOIN receipt_item ri ON r.receipt_id = ri.receipt_id
            JOIN products p ON ri.prod_code = p.prod_code
            WHERE DATE(receipt_date) = ? AND r.owner_id = ?
        ', [$day, $owner_id]))->first();

        $weeklySales = collect(DB::select('
            SELECT IFNULL(SUM(p.selling_price * ri.item_quantity), 0) AS weeklySales
            FROM receipt r
            JOIN receipt_item ri ON r.receipt_id = ri.receipt_id
            JOIN products p ON ri.prod_code = p.prod_code
            WHERE r.receipt_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()
            AND r.owner_id = ?
        ', [$owner_id]))->first();

        $monthSales = collect(DB::select('
            SELECT IFNULL(SUM(p.selling_price * ri.item_quantity), 0) AS monthSales
            FROM receipt r
            JOIN receipt_item ri ON r.receipt_id = ri.receipt_id
            JOIN products p ON ri.prod_code = p.prod_code
            WHERE MONTH(receipt_date) = ? AND r.owner_id = ? AND YEAR(receipt_date) = ?
        ', [$currentMonth, $owner_id, $latestYear]))->first();
        

        $productCategory = collect(DB::select("
            SELECT
            c.category,
            COALESCE(
                SUM(
                CASE 
                    WHEN YEAR(r.receipt_date) = ? AND r.owner_id = ?
                    THEN p.selling_price * ri.item_quantity
                    ELSE 0
                END
                ), 0
            ) AS total_amount,
            c.category_id
            FROM categories c
            LEFT JOIN products p ON c.category_id = p.category_id
            LEFT JOIN receipt_item ri ON p.prod_code = ri.prod_code
            LEFT JOIN receipt r ON ri.receipt_id = r.receipt_id
            WHERE c.owner_id = ?
            GROUP BY c.category_id, c.category
            ORDER BY c.category_id;
        ", [
            $latestYear, $owner_id, $owner_id
        ]))->toArray();
        $productData = array_map(fn($row) => (float) $row->total_amount , $productCategory);

        $productCategoryPrev = collect(DB::select("
            SELECT
            c.category,
            COALESCE(
                SUM(
                CASE 
                    WHEN YEAR(r.receipt_date) = ? AND r.owner_id = ?
                    THEN p.selling_price * ri.item_quantity
                    ELSE 0
                END
                ), 0
            ) AS total_amount,
            c.category_id
            FROM categories c
            LEFT JOIN products p ON c.category_id = p.category_id
            LEFT JOIN receipt_item ri ON p.prod_code = ri.prod_code
            LEFT JOIN receipt r ON ri.receipt_id = r.receipt_id
            WHERE c.owner_id = ?
            GROUP BY c.category_id, c.category
            ORDER BY c.category_id;
        ", [
            $latestYear-1, $owner_id, $owner_id
        ]))->toArray();
        $productPrevData = array_map(fn($row) => (float) $row->total_amount, $productCategoryPrev);

        $productCategoryAve = collect(DB::select("
            SELECT 
                c.category,
                ROUND(AVG(t.year_total), 2) AS avg_total_sales
            FROM (
                SELECT
                    c.category_id,
                    c.category,
                    YEAR(r.receipt_date) AS year,
                    SUM(p.selling_price * ri.item_quantity) AS year_total
                FROM categories c
                JOIN products p ON c.category_id = p.category_id
                JOIN receipt_item ri ON p.prod_code = ri.prod_code
                JOIN receipt r ON ri.receipt_id = r.receipt_id
                WHERE r.owner_id = ?
                GROUP BY c.category_id, c.category, YEAR(r.receipt_date)
            ) AS t
            JOIN categories c ON c.category_id = t.category_id
            GROUP BY c.category_id, c.category
            ORDER BY c.category_id
        ", [$owner_id]))->toArray();
        $productsAveData = array_map(fn($row) => (float) $row->avg_total_sales, $productCategoryAve);

        $categories = array_map(fn($row) => $row->category, $productCategory);




        $stockAlert = DB::select("
            SELECT p.name AS prod_name, p.prod_image, p.stock_limit,
                
                SUM(i.stock) AS total_stock,
                
                -- Usable stock (not expired)
                SUM(CASE 
                    WHEN i.expiration_date IS NULL OR i.expiration_date > CURDATE() 
                    THEN i.stock 
                    ELSE 0 
                END) AS remaining_stock,
                
                -- Expired stock
                SUM(CASE 
                    WHEN i.expiration_date <= CURDATE() 
                    THEN i.stock 
                    ELSE 0 
                END) AS expired_stock,
                
                CASE
                    WHEN SUM(CASE 
                        WHEN i.expiration_date IS NULL OR i.expiration_date > CURDATE() 
                        THEN i.stock 
                        ELSE 0 
                    END) = 0 THEN 'Critical'
                    WHEN SUM(CASE 
                        WHEN i.expiration_date IS NULL OR i.expiration_date > CURDATE() 
                        THEN i.stock 
                        ELSE 0 
                    END) <= 3 THEN 'Critical'
                    WHEN SUM(CASE 
                        WHEN i.expiration_date IS NULL OR i.expiration_date > CURDATE() 
                        THEN i.stock 
                        ELSE 0 
                    END) <= p.stock_limit THEN 'Reorder'
                    ELSE 'Normal'
                END AS status
                
            FROM products p
            JOIN inventory i ON p.prod_code = i.prod_code
            WHERE p.owner_id = ?
                AND p.prod_status = 'active'
            GROUP BY p.prod_code, p.name, p.stock_limit, p.prod_image
            HAVING status IN ('Critical', 'Reorder')
            ORDER BY remaining_stock ASC
        ", [$owner_id]);


        $expiry = DB::select("
            SELECT 
                p.name AS prod_name, i.stock as expired_stock, p.prod_image,
                i.expiration_date, i.batch_number,
                CASE 
                    WHEN i.expiration_date IS NULL THEN NULL
                    ELSE DATEDIFF(i.expiration_date, CURDATE())
                END AS days_until_expiry,
                CASE
                    WHEN i.expiration_date IS NULL THEN 'No Expiry'
                    WHEN DATEDIFF(i.expiration_date, CURDATE()) <= 0 THEN 'Expired'
                    WHEN DATEDIFF(i.expiration_date, CURDATE()) <= 7 THEN 'Critical'
                    WHEN DATEDIFF(i.expiration_date, CURDATE()) <= 30 THEN 'Warning'
                    WHEN DATEDIFF(i.expiration_date, CURDATE()) <= 60 THEN 'Monitor'
                    ELSE 'Safe'
                END AS status
            FROM inventory i
            JOIN products p ON i.prod_code = p.prod_code
            WHERE p.owner_id = ?
                AND i.expiration_date IS NOT NULL 
                AND DATEDIFF(i.expiration_date, CURDATE()) BETWEEN 0 AND 60
                and i.stock > 0
            ORDER BY days_until_expiry ASC;
        ", [$owner_id]);


        
        $month = now()->month;
        $year = now()->year;

        $topProd = DB::select("
            SELECT 
                p.name AS prod_name, 
                p.prod_code, 
                p.prod_image, 
                SUM(ri.item_quantity * p.selling_price) as total_sales,
                SUM(ri.item_quantity) AS unit_sold
            FROM receipt r
            JOIN receipt_item ri ON r.receipt_id = ri.receipt_id
            JOIN products p ON ri.prod_code = p.prod_code 
            WHERE 
                r.owner_id = ?
                AND MONTH(r.receipt_date) = ?
                AND YEAR(r.receipt_date) = ?
            GROUP BY 
                p.prod_code, 
                p.name, 
                p.prod_image
            ORDER BY 
                total_sales DESC
            Limit 10
        ", [$owner_id, $month, $year]);



        
        $baseUrl = env('APP_API_URL');
        

        $stockAlert = array_map(function ($p) use ($baseUrl) {

            if ($p->prod_image && $p->prod_image !== 'assets/no-product-image.png') {
                $imageName = basename($p->prod_image); 
                $p->prod_image = $baseUrl . '/api/dashboard-image/' . $imageName;
            } else {
                $p->prod_image = null;
            }

            return $p;
        }, $stockAlert);

        $expiry = array_map(function ($p) use ($baseUrl) {

            if ($p->prod_image && $p->prod_image !== 'assets/no-product-image.png') {
                $imageName = basename($p->prod_image); 
                $p->prod_image = $baseUrl . '/api/dashboard-image/' . $imageName;
            } else {
                $p->prod_image = null;
            }

            return $p;
        }, $expiry);

        $topProd = array_map(function ($p) use ($baseUrl) {

            if ($p->prod_image && $p->prod_image !== 'assets/no-product-image.png') {
                $imageName = basename($p->prod_image); 
                $p->prod_image = $baseUrl . '/api/dashboard-image/' . $imageName;
            } else {
                $p->prod_image = null;
            }

            return $p;
        }, $topProd);

        $whereClause = "WHERE p.owner_id = ? AND (di.set_to_return_to_supplier IS NULL OR di.set_to_return_to_supplier = ?)";
        $bindings = [$owner_id, 'Damaged'];

        $lossReport = DB::select("
            SELECT 
                di.damaged_id,
                di.damaged_date AS date_reported, 
                di.damaged_type AS type, 
                di.damaged_quantity AS qty,
                di.damaged_reason AS remarks,
                p.name AS prod_name, 
                c.category AS cat_name,
                p.selling_price AS unit_cost,
                (p.selling_price * di.damaged_quantity) AS total_loss,
                CASE 
                    WHEN s.staff_id IS NOT NULL 
                    THEN s.firstname 
                    ELSE o.firstname
                END AS reported_by,
                (SELECT i.batch_number FROM inventory i WHERE i.inven_code = di.inven_code) AS batch_num
            FROM damaged_items di
            join inventory i on i.inven_code = di.inven_code
            JOIN products p ON p.prod_code = i.prod_code
            JOIN categories c ON c.category_id = p.category_id
            
            LEFT JOIN owners o ON o.owner_id = di.owner_id
            LEFT JOIN staff s ON s.staff_id = di.staff_id
            {$whereClause}
            ORDER BY di.damaged_date DESC
        ", $bindings);

        $lossReport = array_map(function($row) {
            return [
                'id'            => $row->damaged_id,
                'product'       => $row->prod_name,
                'quantity'      => $row->qty,
                'estimatedLoss' => (float)$row->total_loss,
                'reason'        => $row->remarks,
            ];
        }, $lossReport);



        $productCategory = DB::select("
            SELECT 
                c.category,
                SUM(x.category_sales) - SUM(x.discount_amount) AS total_amount, 
                c.category_id
            FROM categories c
            LEFT JOIN (
                SELECT 
                    p.category_id,
                    x.receipt_id,
                    x.discount_amount,
                    SUM(x.item_sales) AS category_sales
                FROM (
                    SELECT 
                        r.receipt_id,
                        r.discount_amount,
                        ri.prod_code,
                        ri.item_quantity,
                        ri.item_discount_amount,
                        r.receipt_date,
                        ri.item_quantity * (
                            COALESCE(
                                (SELECT ph.old_selling_price
                                FROM pricing_history ph
                                WHERE ph.prod_code = ri.prod_code
                                AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                                ORDER BY ph.effective_from DESC
                                LIMIT 1),
                                p.selling_price
                            ) 
                        ) - COALESCE(ri.item_discount_amount, 0) AS item_sales
                    FROM receipt r
                    JOIN receipt_item ri ON ri.receipt_id = r.receipt_id
                    JOIN products p ON p.prod_code = ri.prod_code
                    WHERE 
                        r.owner_id = ? 
                        AND p.owner_id = r.owner_id
                        AND YEAR(r.receipt_date) = ?
                ) AS x
                JOIN products p ON p.prod_code = x.prod_code
                GROUP BY p.category_id, x.receipt_id
            ) AS x ON c.category_id = x.category_id
            WHERE c.owner_id = ?
            GROUP BY c.category_id, c.category
            ORDER BY c.category_id;
        ", [
            $owner_id, $latestYear,
            $owner_id
        ]);

        return response()->json([
            'success' => true,
            'owner_name' => $owner_name,
            'months' => $months,
            'year' => $year,
            'day' => $day,
            'profits' => $profits,
            'expenses' => $expenses,
            'profitMonth' => $profitMonth,
            'losses' => $losses,
            'sales' => $sales,
            'netprofits' => $netProfits,
            'currentMonth' => $currentMonth,
            'latestYear' => $latestYear,
            'tableMonthNames' => $tableMonthNames,
            'dailySales' => (float) ($dailySales->dailySales ?? 0),
            'weeklySales' => (float) ($weeklySales->weeklySales ?? 0),
            'monthSales' => (float) ($monthSales->monthSales ?? 0),
            'products' => $productData,
            'productsPrev' => $productPrevData,
            'productsAve'=> $productsAveData,
            'categories' => $categories,
            'stockAlert' => $stockAlert,
            'expiry' => $expiry,
            'topProd' => $topProd,
            'lossReport' => $lossReport,
            'productCategory' => $productCategory,
        ]);
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
