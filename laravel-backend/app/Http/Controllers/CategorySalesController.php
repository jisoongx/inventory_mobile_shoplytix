<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CategorySalesController extends Controller
{
    public function categorySales(Request $request)
    {
        DB::connection()->getPdo()->exec("SET SESSION sql_mode = REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', '')");

        $owner_id = (int) $request->input('owner_id');
        $year     = (int) ($request->input('years') ?? now()->year);
        $month    = (int) ($request->input('months') ?? now()->month);
        $searchWord = $request->input('searchWord');

        $bindings = [
            $owner_id,
            $year,
            $month,

            $owner_id,

            $owner_id,
            $year,
            $month,

            $owner_id
        ];

        $rows = collect(DB::select("
            SELECT 
                c.category,
                COALESCE(cat_aggs.total_sales, 0) AS total_amount,
                COALESCE(cat_aggs.total_cogs, 0) AS cogs,
                COALESCE(cat_aggs.unit_sold, 0) AS unit_sold,
                COALESCE(damaged.damaged_stock, 0) AS damaged_stock,
                COALESCE(inv.stock_left, 0) AS stock_left,
                CASE
                    WHEN COALESCE(cat_aggs.unit_sold,0) > 0 AND COALESCE(cat_aggs.distinct_receipt_days,0) > 0
                    THEN ROUND(COALESCE(inv.stock_left,0) / (COALESCE(cat_aggs.unit_sold,0) / COALESCE(cat_aggs.distinct_receipt_days,0)), 2)
                    ELSE NULL
                END AS days_of_supply,
                c.category_id
            FROM categories c
            LEFT JOIN (
                /* category-level aggregation */
                SELECT
                    t.category_id,
                    SUM(t.category_sales - t.allocated_discount) AS total_sales,
                    SUM(t.item_cogs) AS total_cogs,
                    SUM(t.item_quantity) AS unit_sold,
                    COUNT(DISTINCT t.receipt_id) AS distinct_receipt_days
                FROM (
                    SELECT
                        p.category_id,
                        r.receipt_id,
                        r.discount_amount,
                        SUM(ri.item_quantity) AS item_quantity,
                        SUM(
                            ri.item_quantity * COALESCE(
                                (SELECT ph.old_selling_price
                                FROM pricing_history ph
                                WHERE ph.prod_code = ri.prod_code
                                AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                                ORDER BY ph.effective_from DESC
                                LIMIT 1),
                                p.selling_price
                            ) - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0))
                        ) AS category_sales,
                        SUM(
                            ri.item_quantity * COALESCE(
                                (SELECT ph.old_cost_price
                                FROM pricing_history ph
                                WHERE ph.prod_code = ri.prod_code
                                AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                                ORDER BY ph.effective_from DESC
                                LIMIT 1),
                                p.cost_price
                            )
                        ) AS item_cogs,
                        /* proportional receipt discount */
                        (SUM(
                            ri.item_quantity * COALESCE(
                                (SELECT ph.old_selling_price
                                FROM pricing_history ph
                                WHERE ph.prod_code = ri.prod_code
                                AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                                ORDER BY ph.effective_from DESC
                                LIMIT 1),
                                p.selling_price
                            ) - (ri.item_quantity * COALESCE(ri.item_discount_amount,0))
                        ) / NULLIF((
                            SELECT SUM(
                                ri2.item_quantity * COALESCE(
                                    (SELECT ph2.old_selling_price
                                    FROM pricing_history ph2
                                    WHERE ph2.prod_code = ri2.prod_code
                                    AND r2.receipt_date BETWEEN ph2.effective_from AND ph2.effective_to
                                    ORDER BY ph2.effective_from DESC
                                    LIMIT 1),
                                    p2.selling_price
                                ) - (ri2.item_quantity * COALESCE(ri2.item_discount_amount,0))
                            )
                            FROM receipt_item ri2
                            JOIN products p2 ON p2.prod_code = ri2.prod_code
                            JOIN receipt r2 ON r2.receipt_id = ri2.receipt_id
                            WHERE r2.receipt_id = r.receipt_id
                        ),0)) * r.discount_amount AS allocated_discount
                    FROM receipt r
                    JOIN receipt_item ri ON ri.receipt_id = r.receipt_id
                    JOIN products p ON p.prod_code = ri.prod_code
                    WHERE r.owner_id = ?
                    AND YEAR(r.receipt_date) = ?
                    AND MONTH(r.receipt_date) = ?
                    GROUP BY p.category_id, r.receipt_id, r.discount_amount
                ) AS t
                GROUP BY t.category_id
            ) AS cat_aggs ON cat_aggs.category_id = c.category_id
            LEFT JOIN (
                /* stock left per category */
                SELECT p.category_id, SUM(inv.stock) AS stock_left
                FROM inventory inv
                JOIN products p ON p.prod_code = inv.prod_code
                WHERE p.owner_id = ? AND p.prod_status = 'active' AND inv.is_expired IS NULL
                GROUP BY p.category_id
            ) inv ON inv.category_id = c.category_id
            LEFT JOIN (
                /* damaged stock per category */
                SELECT p.category_id, COALESCE(SUM(d.damaged_quantity),0) AS damaged_stock
                FROM damaged_items d
                JOIN inventory i2 ON i2.inven_code = d.inven_code
                JOIN products p ON p.prod_code = i2.prod_code
                WHERE d.owner_id = ?
                AND YEAR(d.damaged_date) = ?
                AND MONTH(d.damaged_date) = ?
                AND (d.set_to_return_to_supplier IN ('Damaged') OR d.set_to_return_to_supplier IS NULL)
                GROUP BY p.category_id
            ) damaged ON damaged.category_id = c.category_id
            WHERE c.owner_id = ?
            GROUP BY c.category_id, c.category, cat_aggs.total_sales, cat_aggs.total_cogs, cat_aggs.unit_sold, damaged.damaged_stock, inv.stock_left, cat_aggs.distinct_receipt_days
            ORDER BY c.category_id;
        ", $bindings));

        // transform for frontend
        $data = $rows->map(function ($row) {
            if ($row->total_amount > 0) {
                $grossMargin = round(
                    (($row->total_amount - $row->cogs) / $row->total_amount) * 100,
                    1
                );

                $profitability =
                    $grossMargin > 35 ? 'High profitability' :
                    ($grossMargin > 25 ? 'Medium profitability' : 'Low profitability');

                $extra = [];
                if ($row->stock_left < 5) {
                    $extra[] = 'Low stock, prioritize restocking.';
                }
                if ($row->damaged_stock > 0) {
                    $extra[] = 'Review damaged stock handling.';
                }

                $insight = trim($profitability . ' : ' . implode(' ', $extra));
            } else {
                $grossMargin = 0;
                $insight = 'No sales in this period.';
            }

            return [
                'category'    => $row->category,
                'totalSales'  => round((float) $row->total_amount, 2),
                'grossMargin' => $grossMargin,
                'insight'     => $insight,
            ];
        });

        // optional search filter
        if (!empty($searchWord)) {
            $searchWord = strtolower($searchWord);
            $data = $data->filter(fn ($i) =>
                str_contains(strtolower($i['category']), $searchWord)
            )->values();
        }

        return response()->json([
            'data' => $data
        ]);
    }
}
