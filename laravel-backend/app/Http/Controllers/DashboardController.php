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



        $stockAlert = collect($stockAlert)->map(function ($item) {
            $item->image_url = asset('storage/' . ltrim($item->prod_image, '/'));
            return $item;
        });

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
        ]);
    }
}
