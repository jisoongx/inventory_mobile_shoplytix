<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ProductSalesController extends Controller
{ 

    public function prodPerformance(Request $request)
    {
        DB::connection()->getPdo()->exec(
            "SET SESSION sql_mode = REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', '')"
        );

        $owner_id = $request->input('owner_id');

        $year  = $request->input('year', now()->year);
        $month = $request->input('month', now()->month);
        $category = $request->input('category', 'all');

        $perf = collect(DB::select("
            SELECT p.prod_code, p.name AS product_name, c.category AS category, c.category_id,
                COALESCE(SUM(ri.item_quantity), 0) AS unit_sold,
                
                COALESCE(SUM(
                    (ri.item_quantity * COALESCE(
                        (SELECT ph.old_selling_price
                        FROM pricing_history ph
                        WHERE ph.prod_code = ri.prod_code
                        AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                        ORDER BY ph.effective_from DESC
                        LIMIT 1),
                        p.selling_price
                    )) 
                    - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0))
                    - (
                        /* Proportional receipt-level discount allocation */
                        ((ri.item_quantity * COALESCE(
                            (SELECT ph.old_selling_price
                            FROM pricing_history ph
                            WHERE ph.prod_code = ri.prod_code
                            AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                            ORDER BY ph.effective_from DESC
                            LIMIT 1),
                            p.selling_price
                        )) - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0)))
                        / NULLIF((
                            SELECT SUM(
                                (ri2.item_quantity * COALESCE(
                                    (SELECT ph2.old_selling_price
                                    FROM pricing_history ph2
                                    WHERE ph2.prod_code = ri2.prod_code
                                    AND r2.receipt_date BETWEEN ph2.effective_from AND ph2.effective_to
                                    ORDER BY ph2.effective_from DESC
                                    LIMIT 1),
                                    p2.selling_price
                                )) - (ri2.item_quantity * COALESCE(ri2.item_discount_amount, 0))
                            )
                            FROM receipt_item ri2
                            JOIN products p2 ON p2.prod_code = ri2.prod_code
                            JOIN receipt r2 ON r2.receipt_id = ri2.receipt_id
                            WHERE r2.receipt_id = r.receipt_id
                        ), 0)
                        * COALESCE(r.discount_amount, 0)
                    )
                ), 0) AS total_sales,

                COALESCE(SUM(
                    ri.item_quantity * COALESCE(
                        (
                            SELECT ph.old_cost_price
                            FROM pricing_history ph
                            JOIN inventory i ON i.prod_code = ph.prod_code
                            JOIN receipt_item ri2 ON ri2.prod_code = p.prod_code
                            WHERE i.inven_code = ri.inven_code
                            AND ph.effective_from <= i.date_added
                            AND (ph.effective_to IS NULL OR ph.effective_to >= i.date_added)
                            ORDER BY ph.effective_from DESC
                            LIMIT 1
                        ),
                        p.cost_price
                    )
                ), 0) AS cogs,

                COALESCE((
                    SELECT SUM(d.damaged_quantity)
                    FROM damaged_items d
                    JOIN inventory i3 ON i3.inven_code = d.inven_code
                    JOIN products p2 ON p2.prod_code = i3.prod_code
                    WHERE d.owner_id = ?
                        AND YEAR(d.damaged_date) IN (?)
                        AND MONTH(d.damaged_date) IN (?)
                    AND p2.category_id = c.category_id
                    AND (d.set_to_return_to_supplier IN ('Damaged') OR d.set_to_return_to_supplier IS NULL)
                ), 0) AS damaged_stock,

                (COALESCE(SUM(
                    (ri.item_quantity * COALESCE(
                        (SELECT ph.old_selling_price
                        FROM pricing_history ph
                        WHERE ph.prod_code = ri.prod_code
                        AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                        ORDER BY ph.effective_from DESC
                        LIMIT 1),
                        p.selling_price
                    )) 
                    - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0))
                    - (
                        /* Proportional receipt-level discount allocation */
                        ((ri.item_quantity * COALESCE(
                            (SELECT ph.old_selling_price
                            FROM pricing_history ph
                            WHERE ph.prod_code = ri.prod_code
                            AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                            ORDER BY ph.effective_from DESC
                            LIMIT 1),
                            p.selling_price
                        )) - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0)))
                        / NULLIF((
                            SELECT SUM(
                                (ri2.item_quantity * COALESCE(
                                    (SELECT ph2.old_selling_price
                                    FROM pricing_history ph2
                                    WHERE ph2.prod_code = ri2.prod_code
                                    AND r2.receipt_date BETWEEN ph2.effective_from AND ph2.effective_to
                                    ORDER BY ph2.effective_from DESC
                                    LIMIT 1),
                                    p2.selling_price
                                )) - (ri2.item_quantity * COALESCE(ri2.item_discount_amount, 0))
                            )
                            FROM receipt_item ri2
                            JOIN products p2 ON p2.prod_code = ri2.prod_code
                            JOIN receipt r2 ON r2.receipt_id = ri2.receipt_id
                            WHERE r2.receipt_id = r.receipt_id
                        ), 0)
                        * COALESCE(r.discount_amount, 0)
                    )
                ), 0) - COALESCE(SUM(p.cost_price * ri.item_quantity), 0)) AS profit,

                ((COALESCE(SUM(
                    (ri.item_quantity * COALESCE(
                        (SELECT ph.old_selling_price
                        FROM pricing_history ph
                        WHERE ph.prod_code = ri.prod_code
                        AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                        ORDER BY ph.effective_from DESC
                        LIMIT 1),
                        p.selling_price
                    )) 
                    - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0))
                    - (
                        /* Proportional receipt-level discount allocation */
                        ((ri.item_quantity * COALESCE(
                            (SELECT ph.old_selling_price
                            FROM pricing_history ph
                            WHERE ph.prod_code = ri.prod_code
                            AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                            ORDER BY ph.effective_from DESC
                            LIMIT 1),
                            p.selling_price
                        )) - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0)))
                        / NULLIF((
                            SELECT SUM(
                                (ri2.item_quantity * COALESCE(
                                    (SELECT ph2.old_selling_price
                                    FROM pricing_history ph2
                                    WHERE ph2.prod_code = ri2.prod_code
                                    AND r2.receipt_date BETWEEN ph2.effective_from AND ph2.effective_to
                                    ORDER BY ph2.effective_from DESC
                                    LIMIT 1),
                                    p2.selling_price
                                )) - (ri2.item_quantity * COALESCE(ri2.item_discount_amount, 0))
                            )
                            FROM receipt_item ri2
                            JOIN products p2 ON p2.prod_code = ri2.prod_code
                            JOIN receipt r2 ON r2.receipt_id = ri2.receipt_id
                            WHERE r2.receipt_id = r.receipt_id
                        ), 0)
                        * COALESCE(r.discount_amount, 0)
                    )
                ), 0) - COALESCE(SUM(p.cost_price * ri.item_quantity), 0))
                    / NULLIF(COALESCE(SUM(
                    (ri.item_quantity * COALESCE(
                        (SELECT ph.old_selling_price
                        FROM pricing_history ph
                        WHERE ph.prod_code = ri.prod_code
                        AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                        ORDER BY ph.effective_from DESC
                        LIMIT 1),
                        p.selling_price
                    )) 
                    - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0))
                    - (
                        /* Proportional receipt-level discount allocation */
                        ((ri.item_quantity * COALESCE(
                            (SELECT ph.old_selling_price
                            FROM pricing_history ph
                            WHERE ph.prod_code = ri.prod_code
                            AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                            ORDER BY ph.effective_from DESC
                            LIMIT 1),
                            p.selling_price
                        )) - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0)))
                        / NULLIF((
                            SELECT SUM(
                                (ri2.item_quantity * COALESCE(
                                    (SELECT ph2.old_selling_price
                                    FROM pricing_history ph2
                                    WHERE ph2.prod_code = ri2.prod_code
                                    AND r2.receipt_date BETWEEN ph2.effective_from AND ph2.effective_to
                                    ORDER BY ph2.effective_from DESC
                                    LIMIT 1),
                                    p2.selling_price
                                )) - (ri2.item_quantity * COALESCE(ri2.item_discount_amount, 0))
                            )
                            FROM receipt_item ri2
                            JOIN products p2 ON p2.prod_code = ri2.prod_code
                            JOIN receipt r2 ON r2.receipt_id = ri2.receipt_id
                            WHERE r2.receipt_id = r.receipt_id
                        ), 0)
                        * COALESCE(r.discount_amount, 0)
                    )
                    ), 0), 0)) * 100 AS profit_margin_percent,

                COALESCE(
                    (SUM(
                    (ri.item_quantity * COALESCE(
                        (SELECT ph.old_selling_price
                        FROM pricing_history ph
                        WHERE ph.prod_code = ri.prod_code
                        AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                        ORDER BY ph.effective_from DESC
                        LIMIT 1),
                        p.selling_price
                    )) 
                    - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0))
                    - (
                        /* Proportional receipt-level discount allocation */
                        ((ri.item_quantity * COALESCE(
                            (SELECT ph.old_selling_price
                            FROM pricing_history ph
                            WHERE ph.prod_code = ri.prod_code
                            AND r.receipt_date BETWEEN ph.effective_from AND ph.effective_to
                            ORDER BY ph.effective_from DESC
                            LIMIT 1),
                            p.selling_price
                        )) - (ri.item_quantity * COALESCE(ri.item_discount_amount, 0)))
                        / NULLIF((
                            SELECT SUM(
                                (ri2.item_quantity * COALESCE(
                                    (SELECT ph2.old_selling_price
                                    FROM pricing_history ph2
                                    WHERE ph2.prod_code = ri2.prod_code
                                    AND r2.receipt_date BETWEEN ph2.effective_from AND ph2.effective_to
                                    ORDER BY ph2.effective_from DESC
                                    LIMIT 1),
                                    p2.selling_price
                                )) - (ri2.item_quantity * COALESCE(ri2.item_discount_amount, 0))
                            )
                            FROM receipt_item ri2
                            JOIN products p2 ON p2.prod_code = ri2.prod_code
                            JOIN receipt r2 ON r2.receipt_id = ri2.receipt_id
                            WHERE r2.receipt_id = r.receipt_id
                        ), 0)
                        * COALESCE(r.discount_amount, 0)
                    )
                    )/NULLIF(total.total_sales_all, 0)) * 100, 0
                ) AS contribution_percent,

                COALESCE(inv.total_stock, 0) AS remaining_stocks,
                COALESCE(DATEDIFF(MAX(r.receipt_date), MIN(r.receipt_date)) + 1, 0) AS days_active

            FROM products AS p
            LEFT JOIN (
                SELECT i.prod_code, SUM(i.stock) AS total_stock
                FROM inventory i
                JOIN products p2 ON i.prod_code = p2.prod_code
                WHERE p2.owner_id = ? 
                    AND (i.expiration_date IS NULL OR i.expiration_date > CURDATE())
                    AND p2.prod_status = 'active'
                GROUP BY i.prod_code
            ) inv ON inv.prod_code = p.prod_code
            LEFT JOIN categories AS c 
                ON p.category_id = c.category_id
            LEFT JOIN receipt AS r 
                ON r.owner_id = p.owner_id
                AND MONTH(r.receipt_date) = ?  
                AND YEAR(r.receipt_date) = ? 
            LEFT JOIN receipt_item AS ri 
                ON ri.prod_code = p.prod_code
                AND ri.receipt_id = r.receipt_id
            LEFT JOIN (
                SELECT 
                    p2.owner_id, 
                    SUM(
                        (ri2.item_quantity * p2.selling_price) 
                        - (ri2.item_quantity * COALESCE(ri2.item_discount_amount, 0))
                        - (
                            /* Proportional receipt discount */
                            ((ri2.item_quantity * p2.selling_price) - (ri2.item_quantity * COALESCE(ri2.item_discount_amount, 0)))
                            / NULLIF((
                                SELECT SUM(
                                    (ri3.item_quantity * p3.selling_price) - (ri3.item_quantity * COALESCE(ri3.item_discount_amount, 0))
                                )
                                FROM receipt_item ri3
                                JOIN products p3 ON p3.prod_code = ri3.prod_code
                                WHERE ri3.receipt_id = r2.receipt_id
                            ), 0)
                            * COALESCE(r2.discount_amount, 0)
                        )
                    ) AS total_sales_all
                FROM products p2
                JOIN receipt_item ri2 ON ri2.prod_code = p2.prod_code
                JOIN receipt r2 ON r2.receipt_id = ri2.receipt_id
                WHERE MONTH(r2.receipt_date) = ? AND YEAR(r2.receipt_date) = ?
                    AND p2.prod_status = 'active'
                GROUP BY p2.owner_id
            ) total ON total.owner_id = p.owner_id
            WHERE p.owner_id = ? 
                AND p.prod_status = 'active'
            GROUP BY p.prod_code, p.name, c.category, p.owner_id, c.category_id, total.total_sales_all, inv.total_stock
        ", [$owner_id, $year, $month, $owner_id, $month, $year, $month, $year, $owner_id]));

        $perf = $perf->map(function ($row) {

            $row->profit_margin_percent = $row->profit_margin_percent ?? (
                $row->total_sales > 0
                    ? (($row->total_sales - $row->cogs) / $row->total_sales) * 100
                    : 0
            );

            $insights = [];

            $stock   = $row->remaining_stocks ?? 0;
            $sold    = $row->unit_sold ?? 0;
            $damaged = $row->damaged_stock ?? 0;
            $days    = max(1, $row->days_active ?? 1);

            if ($stock == 0 && $damaged > 0 && $sold == 0) {
                $insights[] = "Stock depleted due to damaged items.";
            } elseif ($stock == 0 && $sold > 0) {
                $insights[] = "Out of stock. Reorder needed.";
            } else {
                $dailySales = $sold / $days;

                if ($dailySales > 0 && ($stock / max(1, $dailySales)) < 3) {
                    $insights[] = "Low stock. Reorder soon.";
                }

                if ($sold == 0) {
                    $insights[] = "No sales this period.";
                }
            }

            if ($row->profit <= 0) {
                $insights[] = "Unprofitable.";
            } elseif ($row->profit_margin_percent < 10) {
                $insights[] = "Low margin.";
            } elseif ($row->profit_margin_percent >= 20) {
                $insights[] = "Performing well.";
            } else {
                $insights[] = "Moderate performance.";
            }

            $row->insight = implode(' ', array_unique($insights));

            return $row;
        });

        if ($category !== 'all') {
            $perf = $perf->where('category_id', (int) $category)->values();
        }

        return response()->json($perf->values());
    }

}
