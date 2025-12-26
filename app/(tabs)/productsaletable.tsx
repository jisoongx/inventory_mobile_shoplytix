import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Switch, Alert, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { API } from "../constants";


type ProductPerformanceItem = {
  prod_code: string;
  product_name: string;
  category: string;
  category_id: number;
  unit_sold: number;
  total_sales: number;
  cogs: number;
  profit: number;
  profit_margin_percent: number;
  damaged_stock: number;
  remaining_stocks: number;
  days_active: number;
  insight: string;
};

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function ProductPerformance() {
    const [data, setData] = useState<ProductPerformanceItem[]>([]);
    const [loading, setLoading] = useState(false);

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const [sortBy, setSortBy] = useState<'product' | 'sales' | 'margin'>('product');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [showOnlyWithSales, setShowOnlyWithSales] = useState(false);

    useEffect(() => {
        fetchPerformance();
    }, [selectedMonth, selectedYear]);

    const fetchPerformance = async () => {
        setLoading(true);
        try {

        const ownerId = await AsyncStorage.getItem("owner_id");
        if (!ownerId) {
            Alert.alert("Error", "Please login first");
            return;
        }

        const res = await fetch(`${API}/prod-performance`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerId}`,
            },

            body: JSON.stringify({
            month: selectedMonth,
            year: selectedYear,
            owner_id: Number(ownerId), 
            }),
        });

        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
        } catch (e) {
        console.error('Fetch failed', e);
        setData([]);
        } finally {
        setLoading(false);
        }
    };

    const filteredData = useMemo(() => {
    return showOnlyWithSales
        ? data.filter(i => Number(i.total_sales) > 0)
        : data;
    }, [data, showOnlyWithSales]);

    const totalSales = useMemo(() => {
    return data.reduce(
        (sum, i) => sum + Number(i.total_sales || 0),
        0
    );
    }, [data]);

    const avgMargin = useMemo(() => {
    return filteredData.length > 0
        ? filteredData.reduce(
            (sum, i) => sum + Number(i.profit_margin_percent || 0),
            0
        ) / filteredData.length
        : 0;
    }, [filteredData]);

    const sortedData = useMemo(() => {
        return [...filteredData].sort((a, b) => {
        let aVal: any, bVal: any;

        if (sortBy === 'product') {
            aVal = a.product_name.toLowerCase();
            bVal = b.product_name.toLowerCase();
            return sortOrder === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (sortBy === 'sales') {
            aVal = a.total_sales;
            bVal = b.total_sales;
        } else {
            aVal = a.profit_margin_percent;
            bVal = b.profit_margin_percent;
        }

        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }, [filteredData, sortBy, sortOrder]);

    const getMarginColor = (m: number) => {
        if (m === 0) return '#dc2626';
        if (m < 25) return '#facc15';
        if (m < 35) return '#2563eb';
        return '#16a34a';
    };

    const handleSort = (col: 'product' | 'sales' | 'margin') => {
        if (sortBy === col) {
        setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
        } else {
        setSortBy(col);
        setSortOrder('asc');
        }
    };

  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
            <Text style={styles.title}>Product Performance</Text>
            <Text style={styles.subtitle}>
                Performance and profitability analysis of individual products.
            </Text>
        </View>
        
        {/* Filter Card */}
        <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Period</Text>
            <View style={styles.pickerRow}>
                <View style={styles.pickerWrapper}>
                    <Picker 
                    selectedValue={selectedMonth} 
                    onValueChange={setSelectedMonth}
                    style={styles.picker}
                    >
                    {monthNames.map((m, i) => (
                        <Picker.Item key={i} label={m} value={i + 1} />
                    ))}
                    </Picker>
                </View>

                <View style={styles.pickerWrapper}>
                    <Picker 
                    selectedValue={selectedYear} 
                    onValueChange={setSelectedYear}
                    style={styles.picker}
                    >
                    {[2023, 2024, 2025].map(y => (
                        <Picker.Item key={y} label={String(y)} value={y} />
                    ))}
                    </Picker>
                </View>
            </View>

        </View>
        <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Sales</Text>
                <Text style={styles.summaryValue}>
                ₱{(totalSales / 1000).toFixed(1)}K
                </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Avg Margin</Text>
                <Text style={[styles.summaryValue, { color: getMarginColor(avgMargin) }]}>
                {avgMargin.toFixed(1)}%
                </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Products</Text>
                <Text style={styles.summaryValue}>{filteredData.length}</Text>
            </View>
        </View>

        
        <View style={{ flexDirection: 'row', alignItems: 'center', }}>
            <Text style={{ marginRight: 8, marginLeft: 15 }}>Show only categories with sales</Text>
            <Switch
                value={showOnlyWithSales}
                onValueChange={setShowOnlyWithSales}
            />
        </View>
        
        
        {loading ? (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading data...</Text>
            </View>
        ) : sortedData.length === 0 ? (
        <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptySubtitle}>
            {showOnlyWithSales
                ? 'No products with sales for this period.'
                : 'No products found for this period.'}
            </Text>
        </View>
        ) : (
        <View style={styles.tableCard}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
                <TouchableOpacity 
                    onPress={() => handleSort('product')} 
                    style={styles.headerCol2}
                >
                    <Text style={styles.headerText}>Product</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => handleSort('sales')} 
                    style={styles.headerCol1}
                >
                    <Text style={styles.headerText}>Sales</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => handleSort('margin')} 
                    style={styles.headerCol1}
                >
                    <Text style={styles.headerText}>Margin</Text>
                </TouchableOpacity>
            </View>

            {/* Table Rows */}
            <ScrollView
            style={{
                height: 400,          
            }}
            contentContainerStyle={{
                flexGrow: 1,          
                paddingBottom: 12,
            }}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            >
            {sortedData.map((item, index) => (
                <View key={item.prod_code}>
                <View
                    style={[
                    styles.tableRow,
                    index === sortedData.length - 1 && !item.insight && styles.lastRow,
                    ]}
                >
                    <View style={styles.rowContent}>
                    <Text style={styles.productName} numberOfLines={2}>
                        {item.product_name}
                    </Text>

                    <View style={styles.metricsRow}>
                        <View style={styles.metric}>
                        <Text style={styles.salesValue}>
                            ₱{Number(item.total_sales).toFixed(2)}
                        </Text>
                        </View>

                        <View style={styles.metric}>
                        <Text
                            style={[
                            styles.marginValue,
                            { color: getMarginColor(Number(item.profit_margin_percent)) },
                            ]}
                        >
                            {Number(item.profit_margin_percent).toFixed(1)}%
                        </Text>
                        </View>
                    </View>
                    </View>
                </View>

                {item.insight && (
                    <View
                    style={[
                        styles.insightRow,
                        index === sortedData.length - 1 && styles.lastRow,
                    ]}
                    >
                    <Text style={styles.insightText}>{item.insight}</Text>
                    </View>
                )}
                </View>
            ))}
            </ScrollView>
            <View style={styles.tableFooter}>
                <Text style={styles.footerLabel}>TOTAL</Text>
                <Text style={styles.footerValue}>
                ₱{totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text style={styles.footerMargin}>{avgMargin.toFixed(1)}%</Text>
            </View>

        </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({

tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderTopWidth: 2,
    borderTopColor: '#d1d5db',
    alignItems: 'center',
    marginTop: 8,
    borderWidth:1,
    borderColor:'#e5e7eb',
  },
  footerLabel: {
    flex: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  footerValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    paddingRight: 8,
  },
  footerMargin: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  
summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  container: { 
    flex: 1,
    backgroundColor: '#f8fafc',
    marginBottom: 35,
  },

  header: {
    padding: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  title: { 
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },

  subtitle: {
    fontSize: 13,
    color: '#6b7280',
  },

  filterCard: {
    marginVertical: 12,
    backgroundColor: '#ffffff',
  },

  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  pickerRow: {
    flexDirection: 'row',
    gap: 12,
  },

  pickerWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbced2ff',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },

  picker: {
    height: 50,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: '#e2e8f0',
    padding: 5,
    backgroundColor: '#ffffff',
  },

  toggleLabel: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },

  loadingContainer: {
    alignItems: 'center',
    padding: 48,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },

  emptyState: { 
    alignItems: 'center', 
    padding: 48,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  emptyTitle: { 
    fontSize: 18, 
    fontWeight: '600',
    color: '#0f172a',
  },

  emptySubtitle: { 
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
  },

  tableCard: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    alignItems: 'center',
  },

  headerCol2: { 
    flex: 3,
    paddingRight: 12,
  },

  headerCol1: { 
    flex: 1.2,
    alignItems: 'flex-end',
    paddingLeft: 8,
  },

  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
    minHeight: 60,
  },

  lastRow: {
    borderBottomWidth: 0,
  },

  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  productName: {
    flex: 3,
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    paddingRight: 12,
    lineHeight: 20,
  },

  metricsRow: {
    flex: 2.4,
    flexDirection: 'row',
    alignItems: 'center',
  },

  metric: {
    flex: 1,
    alignItems: 'flex-end',
    paddingLeft: 8,
  },

  metricLabel: {
    display: 'none',
  },

  salesValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },

  marginValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  insightBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  insightRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  insightText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});