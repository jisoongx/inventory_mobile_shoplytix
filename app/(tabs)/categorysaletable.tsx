import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet, ActivityIndicator, TouchableOpacity, Switch
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { API } from "../constants";
import AsyncStorage from '@react-native-async-storage/async-storage';

type CategorySalesItem = {
  category: string;
  totalSales: number;
  grossMargin: number;
  insight: string;
};

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function CategorySalesTable() {
  const [data, setData] = useState<CategorySalesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [years] = useState<number[]>([2023, 2024, 2025]);
  const [sortBy, setSortBy] = useState<'category' | 'sales' | 'margin'>('category');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showOnlyWithSales, setShowOnlyWithSales] = useState(false);

  useEffect(() => {
    fetchCategorySales();
  }, [selectedMonth, selectedYear]);

  const fetchCategorySales = async () => {
    setLoading(true);
    try {
      const ownerIdRaw = await AsyncStorage.getItem('owner_id');
      const owner_id = ownerIdRaw ? Number(ownerIdRaw) : null;

      console.log('=== REQUEST DEBUG ===');
      console.log('Owner ID:', owner_id);
      console.log('Month:', selectedMonth);
      console.log('Year:', selectedYear);
      console.log('API URL:', `${API}/category-sales`);

      const response = await fetch(`${API}/category-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          months: selectedMonth,
          years: selectedYear,
          owner_id,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const text = await response.text();
      console.log('Raw response:', text);

      const json = JSON.parse(text);
      console.log('CATEGORY SALES API RESPONSE:', json);

      if (!json.data) {
        console.error('No data property in response');
        setData([]);
        return;
      }

      const normalized: CategorySalesItem[] = (json.data || []).map((i: any) => ({
        category: String(i.category),
        totalSales: Number(i.totalSales) || 0,
        grossMargin: Number(i.grossMargin) || 0,
        insight: String(i.insight ?? ''),
      }));

      console.log('Normalized data:', normalized);
      setData(normalized);
    } catch (e) {
      console.error('Category sales fetch failed:', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const totalSales = data.reduce((sum, i) => sum + i.totalSales, 0);

  
  const filteredData = showOnlyWithSales
    ? data.filter(item => item.totalSales > 0)
    : data;

  const avgMargin =
    filteredData.length > 0
      ? filteredData.reduce((sum, i) => sum + i.grossMargin, 0) / filteredData.length
      : 0;

  const getMarginColor = (margin: number) => {
    if (margin === 0) return '#ea0808ff';     
    if (margin < 25) return '#eadf08ff';       
    if (margin < 35) return '#3108eaff';       
    return '#22c55e';                        
  };

  const handleSort = (column:any) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortedData = (arrayToSort: CategorySalesItem[]) => {
    const sorted = [...arrayToSort].sort((a, b) => {
      let aValue, bValue;

      if (sortBy === 'category') {
        aValue = a.category.toLowerCase();
        bValue = b.category.toLowerCase();
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else if (sortBy === 'sales') {
        aValue = a.totalSales;
        bValue = b.totalSales;
      } else {
        aValue = a.grossMargin;
        bValue = b.grossMargin;
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales by Category</Text>
        <Text style={styles.headerSubtitle}>
          Performance and profitability analysis
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <View style={styles.pickerWrapper}>
            <Text style={styles.filterLabel}>Month</Text>
            <View style={styles.pickerBorder}>  
              <Picker
                selectedValue={selectedMonth}
                onValueChange={setSelectedMonth}
                style={styles.picker}
              >
                {monthNames.map((name, i) => (
                  <Picker.Item key={i} label={name} value={i + 1} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.pickerWrapper}>
            <Text style={styles.filterLabel}>Year</Text>
            <View style={styles.pickerBorder}>  
              <Picker
                selectedValue={selectedYear}
                onValueChange={setSelectedYear}
                style={styles.picker}
              >
                {years.map(y => (
                  <Picker.Item key={y} label={String(y)} value={y} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Category Data</Text>
          <Text style={styles.emptySubtitle}>
            No sales data found for the selected period
          </Text>
        </View>
      ) : (
        <>
          {/* Summary Bar */}
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
              <Text style={styles.summaryLabel}>Categories</Text>
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

          {/* Compact Table */}
          
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <TouchableOpacity 
                style={[styles.headerButton, { flex: 2 }]}
                onPress={() => handleSort('category')}
                activeOpacity={0.7}
              >
                <Text style={styles.headerText}>CATEGORY 
                  {sortBy === 'category' && (
                    <Text style={styles.sortIcon}>{sortOrder === 'asc' ? '↑' : '↓'}</Text>
                  )}
                </Text>
                
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.headerButton, { flex: 1 }]}
                onPress={() => handleSort('sales')}
                activeOpacity={0.7}
              >
                <Text style={[styles.headerText, { textAlign: 'left' }]}>SALES
                  {sortBy === 'sales' && (
                    <Text style={styles.sortIcon}>{sortOrder === 'asc' ? '↑' : '↓'}</Text>
                  )}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.headerButton, { flex: 1 }]}
                onPress={() => handleSort('margin')}
                activeOpacity={0.7}
              >
                <Text style={[styles.headerText, { textAlign: 'center' }]}>MARGIN
                  {sortBy === 'margin' && (
                    <Text style={styles.sortIcon}>{sortOrder === 'asc' ? '↑' : '↓'}</Text>
                  )}
                </Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView
              style={{
                maxHeight: 400,          
                flexGrow: 0,
              }}
              contentContainerStyle={{
                paddingBottom: 5,
              }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Table Rows */}
              {filteredData.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6b7280' }}>
                    No categories to display
                  </Text>
                  <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>
                    {showOnlyWithSales
                      ? 'No categories with sales for the selected period.'
                      : 'No categories available.'}
                  </Text>
                </View>
              ) : (
                getSortedData(filteredData).map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <View style={styles.rowMain}>
                      {/* Category Name */}
                      <Text style={styles.categoryText} numberOfLines={1}>
                        {item.category}
                      </Text>

                      {/* Sales Amount */}
                      <Text style={styles.salesText}>
                        ₱{item.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>

                      {/* Margin Badge */}
                      <View
                        style={[
                          styles.marginBadge,
                          { backgroundColor: getMarginColor(item.grossMargin) },
                        ]}
                      >
                        <Text style={styles.marginText}>{item.grossMargin.toFixed(1)}%</Text>
                      </View>
                    </View>

                    {/* Insight Row */}
                    <Text style={styles.insightText} numberOfLines={2}>
                      {item.insight}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.tableFooter}>
              <Text style={styles.footerLabel}>TOTAL</Text>
              <Text style={styles.footerValue}>
                ₱{totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.footerMargin}>{avgMargin.toFixed(1)}%</Text>
            </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginBottom: 15,
    marginTop: 15,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerWrapper: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  pickerBorder: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    backgroundColor: '#fff',
    overflow: 'hidden',  
  },
  picker: {
    height: 50, 
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  tableScroll: {
    maxHeight: 400,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sortIcon: {
    fontSize: 14,
    color: '#000000ff',
    fontWeight: '900',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
  },
  tableRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryText: {
    flex: 2,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    paddingRight: 8,
  },
  salesText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'left',
  },
  marginBadge: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
  },
  marginText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  insightText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    paddingLeft: 0,
  },
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
    flex: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  footerValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'left',
    paddingRight: 8,
  },
  footerMargin: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
});


