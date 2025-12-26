import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image
} from "react-native";
import { LineChart} from 'react-native-chart-kit';
import { API } from "../constants";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CategorySalesTable from './categorysaletable';
import ProductSalesTable from './productsaletable';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [chartLoading, setChartLoading] = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview");
  const scrollViewRef = useRef<ScrollView>(null);

  const pollingIntervalRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const POLLING_INTERVAL = 30000;

  // const totalLoss = lossReport.reduce((sum, item) => sum + item.estimatedLoss, 0);
  // ------------------------------
  // FETCH DASHBOARD DATA
  // ------------------------------
  const fetchDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const ownerId = await AsyncStorage.getItem("owner_id");
      if (!ownerId) {
        Alert.alert("Error", "Please login first");
        return;
      }

      const res = await fetch(`${API}/dashboard?owner_id=${ownerId}&year=${selectedYear}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setDashboardData(data);
      } else if (!silent) {
        Alert.alert("Error", data.message || "Failed to fetch dashboard data.");
      }
    } catch (error) {
      if (!silent) {
        console.error("Dashboard fetch error:", error);
        if (error instanceof Error) {
          Alert.alert("Error", `Unable to connect: ${error.message}`);
        } else {
          Alert.alert("Error", "An unexpected error occurred.");
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ------------------------------
  // FETCH CHART DATA
  // ------------------------------
  const fetchChartData = async (year: number) => {
    try {
      setChartLoading(true);
      const ownerId = await AsyncStorage.getItem("owner_id");
      if (!ownerId) return;

      const res = await fetch(`${API}/dashboard?owner_id=${ownerId}&year=${year}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setDashboardData((prev: any) => ({
          ...prev,
          profitMonth: data.profitMonth,
          profits: data.profits,
          months: data.months,
          year: data.year || prev.year,
        }));
      }
    } catch (error) {
      console.error("Chart fetch error:", error);
    } finally {
      setChartLoading(false);
    }
  };

  // ------------------------------
  // HANDLE YEAR CHANGE
  // ------------------------------
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    fetchChartData(year);
  };

  // ------------------------------
  // POLLING
  // ------------------------------
  const startPolling = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => {
      console.log('🔄 Polling dashboard data...');
      fetchDashboard(true);
    }, POLLING_INTERVAL);
    console.log(`✅ Polling started (every ${POLLING_INTERVAL / 1000} seconds)`);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('⏹️ Polling stopped');
    }
  };

  // ------------------------------
  // APP STATE CHANGE
  // ------------------------------
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App came to foreground - resuming polling');
        startPolling();
        fetchDashboard(true);
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('📱 App went to background - pausing polling');
        stopPolling();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // ------------------------------
  // INITIAL FETCH & POLLING
  // ------------------------------
  useEffect(() => {
    fetchDashboard();
    startPolling();
    return () => stopPolling();
  }, []);

  // ------------------------------
  // UPDATE POLLING ON YEAR CHANGE
  // ------------------------------
  useEffect(() => {
    fetchChartData(selectedYear);
    stopPolling();
    startPolling();
  }, [selectedYear]);

  // ------------------------------
  // AUTO SCROLL CHART
  // ------------------------------
  const months = dashboardData?.months || [];
  useEffect(() => {
    if (scrollViewRef.current && !chartLoading && months.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 300);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 500);
    }
  }, [chartLoading, months.length]);

  // ------------------------------
  // LOADING / ERROR STATES
  // ------------------------------
  if (loading) {
    return (
      <View style={headerStyle.center}>
        <ActivityIndicator size="large" color="#b91c1c" />
        <Text>Loading dashboard...</Text>
      </View>
    );
  }

  if (!dashboardData) {
    return (
      <View style={headerStyle.center}>
        <Text style={{ color: "red" }}>No dashboard data available.</Text>
      </View>
    );
  }

  // ------------------------------
  // DATA DESTRUCTURE
  // ------------------------------
  const {
    owner_name,
    dailySales = 0,
    weeklySales = 0,
    monthSales = 0,
    profitMonth = 0,
    profits = [],
    months: chartMonths = [],
    year = [],
    categories = [],
    products = [],
    losses = [],
    sales = [],
    stockAlert = [],
    expiry = [],
    topProd = [],
    lossReport = [],
    productCategory = [],
    categorySales = [],
  } = dashboardData;

  const dateDisplay = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const day = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
  const month = new Date().toLocaleDateString('en-US', { month: 'long', timeZone: 'Asia/Manila' });
  const totalLoss = lossReport.reduce((sum:any, item:any) => sum + parseFloat(item.estimatedLoss  || 0), 0);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [2025, 2024];

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '₱0.00';
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusColor = (stock_status: string) => {
    switch(stock_status) {
      case 'Critical': return { border: '#EF4444', text: '#DC2626', dot: '#EF4444' };
      case 'Warning': return { border: '#F97316', text: '#EA580C', dot: '#F97316' };
      case 'Out of Stock': return { border: '#7f1d1d', text: '#7f1d1d', dot: '#7f1d1d' };
      default: return { border: '#E5E7EB', text: '#6B7280', dot: '#9CA3AF' };
    }
  };

  const getExpiryStatusColor = (status: string) => {
    switch (status) {
      case 'Expired': return { border: '#7f1d1d', text: '#7f1d1d', dot: '#7f1d1d' };
      case 'Critical': return { border: '#ef4444', text: '#dc2626', dot: '#ef4444' };
      case 'Warning': return { border: '#f97316', text: '#ea580c', dot: '#f97316' };
      case 'Monitor': return { border: '#eab308', text: '#ca8a04', dot: '#eab308' };
      default: return { border: '#d1d5db', text: '#6b7280', dot: '#9ca3af' };
    }
  };

  return (
    <SafeAreaView style={headerStyle.safeArea}>
      <ScrollView style={headerStyle.container}>

        <View style={headerStyle.tabButtonContainer}>
          <TouchableOpacity
            style={[headerStyle.tabButton, activeTab === "overview" && headerStyle.tabButtonActive]}
            onPress={() => setActiveTab("overview")}
          >
            <Text style={[headerStyle.tabButtonText, activeTab === "overview" && headerStyle.tabButtonTextActive]}>
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[headerStyle.tabButton, activeTab === "reports" && headerStyle.tabButtonActive]}
            onPress={() => setActiveTab("reports")}
          >
            <Text style={[headerStyle.tabButtonText, activeTab === "reports" && headerStyle.tabButtonTextActive]}>
              Reports
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "overview" ? (
          <View>
            <Text style={headerStyle.dateText}>{dateDisplay}</Text>
            <Text style={headerStyle.welcome}>Welcome, {owner_name}!</Text>

            {/* currency dapit */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={headerStyle.salesScrollContainer}
            >
              <View style={[headerStyle.card, headerStyle.cardRed]}>
                <View style={headerStyle.cardGradientOverlay} />
                <Text style={headerStyle.salesValueBig}>
                  ₱{Number(dailySales).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text style={headerStyle.salesLabel}>Daily Sales</Text>
                <View style={headerStyle.cardDecoration} />
              </View>

              <View style={[headerStyle.card, headerStyle.cardOrange]}>
                <View style={headerStyle.cardGradientOverlay} />
                <Text style={headerStyle.salesValue}>
                  ₱{Number(weeklySales).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text style={headerStyle.salesLabel}>Last 7 Days</Text>
                <View style={headerStyle.cardDecoration} />
              </View>

              <View style={[headerStyle.card, headerStyle.cardGreen]}>
                <View style={headerStyle.cardGradientOverlay} />
                <Text style={headerStyle.salesValue}>
                  ₱{(Number(monthSales) / 1000).toFixed(1)}k
                </Text>
                <Text style={headerStyle.salesLabel}>This Month's Sales</Text>
                <View style={headerStyle.cardDecoration} />
              </View>
            </ScrollView>
          
            <View style={styles.profitCard}>
              {/* Header Section */}
              <View style={styles.headerSection}>
                <View style={styles.headerTop}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name="trending-up" size={24} color="#b91c1c" />
                  </View>
                  <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Monthly Net Profit</Text>
                    <Text style={styles.headerSubtitle}>Performance overview</Text>
                  </View>
                </View>

                {/* Profit Display */}
                <View style={styles.profitDisplay}>
                  <View style={styles.dateSection}>
                    <Text style={styles.monthText}>{month}</Text>
                    <Text style={styles.dayText}>{day}</Text>
                  </View>

                  <View style={styles.amountSection}>
                    {profitMonth === null || profitMonth === 0 ? (
                      <Text style={styles.emptyAmount}>₱0.00</Text>
                    ) : (
                      <Text style={styles.profitAmount}>
                        {formatCurrency(profitMonth)}
                      </Text>
                    )}
                    <View style={styles.labelBadge}>
                      <MaterialIcons name="account-balance-wallet" size={12} color="#059669" />
                      <Text style={styles.labelText}>Current Net Profit</Text>
                    </View>
                  </View>
                </View>

                {/* Year Picker */}
                <View style={styles.yearPickerSection}>
                  <MaterialIcons name="calendar-today" size={16} color="#6b7280" />
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedYear}
                      onValueChange={handleYearChange}
                      style={styles.yearPicker}
                    >
                      {years.length > 0 ? (
                        years.map((y: any) => (
                          <Picker.Item 
                            key={y} 
                            label={y.toString()} 
                            value={y} 
                          />
                        ))
                      ) : (
                        <Picker.Item
                          label={new Date().getFullYear().toString()} 
                          value={new Date().getFullYear()} 
                        />
                      )}
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Chart Section */}
              <View style={styles.chartSection}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>Yearly Trends</Text>
                  <View style={styles.legendContainer}>
                    <View style={styles.legendDot} />
                    <Text style={styles.legendText}>Profit</Text>
                  </View>
                </View>

                {chartLoading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#b91c1c" />
                    <Text style={styles.loadingText}>Loading chart...</Text>
                  </View>
                ) : (
                  <>
                    <ScrollView
                      ref={scrollViewRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.scrollContent}
                    >
                      <LineChart
                        data={{
                          labels: months.length > 0 ? months : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                          datasets: [{ 
                            data: profits.length > 0 ? profits : [0] 
                          }],
                        }}
                        width={Math.max(500, months.length * 60)}
                        height={360}
                        fromZero={true}
                        segments={4}
                        chartConfig={{
                          backgroundGradientFrom: '#ffffff',
                          backgroundGradientTo: '#ffffff',
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(185, 28, 28, ${opacity})`,
                          propsForBackgroundLines: {
                            stroke: '#f3f4f6', 
                            strokeWidth: '1.5',
                            strokeDasharray: '0',
                          },
                          propsForDots: { 
                            r: '6', 
                            strokeWidth: '3', 
                            stroke: '#b91c1c', 
                            fill: '#ffffff' 
                          },
                          fillShadowGradientFrom: '#dc2626',
                          fillShadowGradientFromOpacity: 0.25,
                          fillShadowGradientTo: '#fef2f2',
                          fillShadowGradientToOpacity: 0.05,
                          propsForLabels: {
                            fontSize: 11,
                            fontWeight: '600',
                            fill: '#6b7280',
                          },
                        }}
                        style={{
                          paddingTop: 25,
                          paddingBottom: -40,
                          paddingLeft: -90,
                          paddingHorizontal: 8,
                        }}
                        bezier
                        withInnerLines={true}
                        withOuterLines={false}
                        withVerticalLabels={true}
                        withHorizontalLabels={false}
                        withDots={true}
                        withShadow={false}
                        renderDotContent={({ x, y, index }: any) => {
                          const profitValue = profits[index];
                          if (!profitValue || profitValue === 0) return null;
                          
                          return (
                            <View
                              key={`dot-${index}`}
                              style={{
                                position: 'absolute',
                                top: y - 35,
                                left: x - 35,
                                backgroundColor: '#b91c1c',
                                paddingHorizontal: 8,
                                paddingVertical: 5,
                                borderRadius: 6,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.2,
                                shadowRadius: 3,
                                elevation: 2,
                              }}
                            >
                              <Text style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: '#ffffff',
                              }}>
                                {formatCurrency(profitValue)}
                              </Text>
                            </View>
                          );
                        }}
                      />
                    </ScrollView>

                    {/* Summary Stats */}
                    {profits.length > 0 && (
                      <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                          <MaterialIcons name="arrow-upward" size={16} color="#059669" />
                          <Text style={styles.statLabel}>Highest</Text>
                          <Text style={styles.statValue}>
                            {formatCurrency(Math.max(...profits))}
                          </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                          <MaterialIcons name="arrow-downward" size={16} color="#dc2626" />
                          <Text style={styles.statLabel}>Lowest</Text>
                          <Text style={styles.statValue}>
                            {formatCurrency(Math.min(...profits))}
                          </Text>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Stock Alert Card */}
            <View style={stockStyles.container}>
              {/* Floating Header Badge */}
              <View style={stockStyles.headerWrapper}>
                <View style={stockStyles.headerBadge}>
                  <Text style={stockStyles.headerBadgeText}>Stock Alert</Text>
                </View>
              </View>

              {/* Content Area */}
              <ScrollView 
                style={stockStyles.scrollView}
                contentContainerStyle={stockStyles.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {stockAlert.length > 0 ? (
                  stockAlert.map((product: any, index: any) => {
                    const colors = getStatusColor(product.stock_status);
                    
                    return (
                      <View 
                        key={index} 
                        style={[
                          stockStyles.productCard,
                          { borderColor: colors.border }
                        ]}
                      >
                        {/* Product Image */}
                        <View style={stockStyles.imageContainer}>
                          <Image
                            source={{ uri: product.prod_image || 'https://via.placeholder.com/100' }}
                            style={stockStyles.imageContainer}
                            resizeMode="cover"
                          />
                        </View>

                        {/* Product Info */}
                        <View style={stockStyles.productInfo}>
                          <Text style={stockStyles.productName} numberOfLines={1}>
                            {product.prod_name}
                          </Text>
                          <Text style={[stockStyles.stockRemaining, { color: colors.text }]}>
                            {product.total_stock} items left
                          </Text>
                        </View>

                        {/* Status Badge */}
                        <View style={stockStyles.statusSection}>
                          <View style={[stockStyles.statusDot, { backgroundColor: colors.dot }]} />
                          <Text style={[stockStyles.statusText, { color: colors.text }]}>
                            {product.stock_status}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={stockStyles.emptyState}>
                    <Ionicons style={stockStyles.emptyIcon} name="cart"></Ionicons>
                    <Text style={stockStyles.emptyText}>
                      Everything is well stocked! No items need restocking right now.
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={stockStyles.footer}>
                <Ionicons style={stockStyles.footerIcon} name="cart"></Ionicons>
                <Text style={stockStyles.footerText}>
                  {stockAlert.length} {stockAlert.length === 1 ? 'item requires' : 'items require'} restocking
                </Text>
              </View>
            </View>

            {/* Expiration Card */}
            <View style={expirationStyles.container}>
              {/* Floating Header Badge */}
              <View style={expirationStyles.headerWrapper}>
                <View style={expirationStyles.headerBadge}>
                  <Text style={expirationStyles.headerBadgeText}>Expiration Notice</Text>
                </View>
              </View>

              {/* Content Area */}
              <ScrollView 
                style={expirationStyles.scrollView}
                contentContainerStyle={expirationStyles.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {expiry.length > 0 ? (
                  expiry.map((product:any, index:any) => {
                    const colors = getExpiryStatusColor(product.status);
                    
                    return (
                      <View 
                        key={index} 
                        style={[
                          expirationStyles.productCard,
                          { borderColor: colors.border }
                        ]}
                      >
                        {/* Product Image */}
                        <View style={expirationStyles.imageContainer}>
                          <Image
                            source={{ uri: product.prod_image || 'https://via.placeholder.com/100' }}
                            style={stockStyles.imageContainer}
                            resizeMode="cover"
                          />
                        </View>

                        {/* Product Info */}
                        <View style={expirationStyles.productInfo}>
                          <Text style={expirationStyles.productName} numberOfLines={1}>
                            {product.prod_name}
                          </Text>
                          <Text style={expirationStyles.productDetail}>
                            <Text style={expirationStyles.batchNumber}>
                              {product.batch_number}
                            </Text>
                            {' • '}
                            {product.expired_stock} items
                          </Text>
                          <Text style={[expirationStyles.daysLeft, { color: colors.text }]}>
                            {product.days_until_expiry} days left!
                          </Text>
                        </View>

                        {/* Status Badge */}
                        <View style={expirationStyles.statusSection}>
                          <View style={[expirationStyles.statusDot, { backgroundColor: colors.dot }]} />
                          <Text style={[expirationStyles.statusText, { color: colors.text }]}>
                            {product.status}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={expirationStyles.emptyState}>
                    <Ionicons style={stockStyles.emptyIcon} name="alert-circle"></Ionicons>
                    <Text style={expirationStyles.emptyText}>
                      There are currently no products set to expire within the next 60 days.
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={expirationStyles.footer}>
                <Ionicons style={stockStyles.footerIcon} name="alert-circle"></Ionicons>
                <Text style={expirationStyles.footerText}>
                  {expiry.length} {expiry.length === 1 ? 'item is' : 'items are'} set to expire in less than 60 days
                </Text>
              </View>
            </View>
            
            {/* Top selling Card */}
            <View style={topSellingStyle.container}>
              <View style={topSellingStyle.headerContainer}>
                <View style={topSellingStyle.header}>
                  <View>
                    <Text style={topSellingStyle.headerTitle}>TOP SELLING PRODUCTS</Text>
                    <Text style={topSellingStyle.headerSubtitle}>Best performers this month</Text>
                  </View>
                  <View style={topSellingStyle.countBadge}>
                    <Text style={topSellingStyle.countNumber}>{topProd.length}</Text>
                    <Text style={topSellingStyle.countLabel}>items</Text>
                  </View>
                </View>
              </View>
              {/* Scrollable Products List */}
              <ScrollView style={topSellingStyle.scrollView} contentContainerStyle={topSellingStyle.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}>
                {topProd.length === 0 ? (
                  <View style={topSellingStyle.emptyContainer}>
                    <Ionicons style={stockStyles.emptyIcon} name="flame"></Ionicons>
                    <Text style={topSellingStyle.emptyText}>Nothing to show.</Text>
                  </View>
                ) : (
                  topProd.map((p:any, index:any) => {
                    if (index === 0) {
                      return (
                        <View key={index} style={topSellingStyle.bestSellerCard}>
                          <View style={topSellingStyle.bestSellerBadge}>
                            <Text style={topSellingStyle.bestSellerBadgeText}>#1 BEST SELLER</Text>
                          </View>

                          <View style={stockStyles.imageContainer}>
                            <Image
                              source={{ uri: p.prod_image || 'https://via.placeholder.com/100' }}
                              style={stockStyles.imageContainer}
                              resizeMode="cover"
                            />
                          </View>
                          <View style={topSellingStyle.productInfo}>
                            <Text style={topSellingStyle.bestSellerName}>{p.prod_name}</Text>
                            <View style={topSellingStyle.statsRow}>
                              <Text style={topSellingStyle.bestSellerSold}>{p.unit_sold} sold</Text>
                              <Text style={topSellingStyle.bestSellerSales}>
                                ₱{parseFloat(p.total_sales).toLocaleString('en-US', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    } else {
                      // Regular Product Cards
                      return (
                        <View key={index} style={topSellingStyle.regularCard}>
                          <View style={stockStyles.imageContainer}>
                            <Image
                              source={{ uri: p.prod_image || 'https://via.placeholder.com/100' }}
                              style={stockStyles.imageContainer}
                              resizeMode="cover"
                            />
                          </View>
                          <View style={topSellingStyle.rankBadge}>
                            <Text style={topSellingStyle.rankText}>#{index + 1}</Text>
                          </View>
                          <View style={topSellingStyle.productInfo}>
                            <Text style={topSellingStyle.regularName}>{p.prod_name}</Text>
                            <View style={topSellingStyle.statsRow}>
                              <Text style={topSellingStyle.regularSold}>{p.unit_sold} sold</Text>
                              <Text style={topSellingStyle.regularSales}>
                                ₱{parseFloat(p.total_sales).toLocaleString('en-US', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    }
                  })
                )}
              </ScrollView>
            </View>

          </View>
        ) : (
          <View style={reportStyle.container}>
            <View style={reportStyle.header}>
              <Text style={reportStyle.title}>Revenue Loss Report</Text>
              <View style={reportStyle.totalContainer}>
                <Text style={reportStyle.totalLabel}>Total Estimated Loss</Text>
                <Text style={reportStyle.totalAmount}>
                  ₱{totalLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={reportStyle.tableContainer}>
                  {/* Table Header */}
                  <View style={reportStyle.tableHeader}>
                    <Text style={[reportStyle.tableHeaderText, reportStyle.columnProduct]}>Product</Text>
                    <Text style={[reportStyle.tableHeaderText, reportStyle.columnQuantity]}>Qty</Text>
                    <Text style={[reportStyle.tableHeaderText, reportStyle.columnLoss]}>Est. Loss</Text>
                    <Text style={[reportStyle.tableHeaderText, reportStyle.columnReason]}>Reason</Text>
                  </View>

                  {lossReport.length === 0 ? (
                    <View
                      style={{
                        paddingVertical: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: '#6b7280',
                        }}
                      >
                        Nothing to show
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: '#9ca3af',
                          marginTop: 4,
                          textAlign: 'center',
                        }}
                      >
                        No loss records available for the selected period.
                      </Text>
                    </View>
                  ) : (
                    lossReport.map((item: any, index: number) => (
                      <View
                        key={item.id}
                        style={[
                          reportStyle.tableRow,
                          index % 2 === 0
                            ? reportStyle.tableRowEven
                            : reportStyle.tableRowOdd,
                        ]}
                      >
                        <Text
                          style={[
                            reportStyle.tableCellText,
                            reportStyle.columnProduct,
                          ]}
                          numberOfLines={2}
                        >
                          {item.product}
                        </Text>

                        <Text
                          style={[
                            reportStyle.tableCellText,
                            reportStyle.columnQuantity,
                          ]}
                        >
                          {item.quantity}
                        </Text>

                        <Text
                          style={[
                            reportStyle.tableCellText,
                            reportStyle.columnLoss,
                            reportStyle.lossAmount,
                          ]}
                        >
                          ₱{item.estimatedLoss.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Text>

                        <Text
                          style={[
                            reportStyle.tableCellText,
                            reportStyle.columnReason,
                          ]}
                          numberOfLines={2}
                        >
                          {item.reason}
                        </Text>
                      </View>
                    ))
                  )}

                </View>
                
              </ScrollView>
            </View>
            <View>
              {/* ARI IBUTANG ANG SALES BY CATEGROY */}
              <CategorySalesTable />
              <ProductSalesTable />
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const headerStyle = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  tabButtonContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 6,
    marginBottom: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  tabButtonActive: {
    backgroundColor: '#DC2626',
    shadowColor: '#B91C1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(185, 28, 28, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dateText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  welcome: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(220, 38, 38, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  salesScrollContainer: {
    paddingRight: 16,
    gap: 16,
  },
  card: {
    width: 250,
    borderRadius: 20,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  cardRed: {
    backgroundColor: '#EF4444',
  },
  cardOrange: {
    backgroundColor: '#F59E0B',
  },
  cardGreen: {
    backgroundColor: '#10B981',
  },
  cardGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardIcon: {
    fontSize: 36,
  },
  cardDecoration: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  salesValueBig: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
    letterSpacing: -1,
  },
  salesValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
    letterSpacing: -1,
  },
  salesLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 1)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reportsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  reportsText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 22,
  },
});


const styles = StyleSheet.create({
  /* MAIN CARD */
  profitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    marginTop: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  
  /* HEADER SECTION */
  headerSection: {
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  
  /* PROFIT DISPLAY */
  profitDisplay: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  dateSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 2,
  },
  amountSection: {
    flex: 1,
    justifyContent: 'center',
  },
  profitAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#059669',
    marginBottom: 6,
  },
  emptyAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#d1d5db',
    marginBottom: 6,
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  
  /* YEAR PICKER */
  yearPickerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickerWrapper: {
    flex: 1,
  },
  yearPicker: {
    height: 52,
  },
  
  /* DIVIDER */
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 20,
  },
  
  /* CHART SECTION */
  chartSection: {
    padding: 20,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#b91c1c',
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b91c1c',
  },
  
  /* LOADING */
  loaderContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  
  /* CHART */
  scrollContent: {
    paddingRight: 20,
  },
  
  /* STATS */
  statsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },

  chartContainer: {
    marginVertical: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 600,
  },
  pieChartSection: {
    paddingRight: 20,
  },
  pieChart: {
    borderRadius: 16,
  },
  legendSection: {
    flex: 1,
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
    maxHeight: 280,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  legendScroll: {
    flex: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  legendTextEmpty: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  legendRight: {
    alignItems: 'flex-end',
  },
  legendAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  legendPercentage: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
});



const profitStyle = StyleSheet.create({
  profitCardContainer: {
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 12,
    borderColor: "#ced0d3ff",
    borderWidth: 1,
    marginTop: 12,
  },

  profitCardHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f2937",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },

  profitCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  profitDateContainer: {},

  profitMonthYear: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },

  profitDayDate: {
    fontSize: 12,
    color: "#6b7280",
  },

  profitAmountContainer: {
    alignItems: "center",
  },

  profitAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },

  profitEmptyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#dc2626",
  },

  profitAmountLabel: {
    fontSize: 12,
    marginTop: 3,
    color: "#6b7280",
  },

  profitActionsContainer: {
    justifyContent: "flex-end",
    flexDirection: "row",
  },

  profitYearPickerContainer: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    width: 90,
    height: 38,
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },

  profitYearPicker: {
    width: "100%",
    height: "100%",
  },

  // Chart
  profitChartContainer: {
    marginTop: 10,
  },

  profitChartWrapper: {
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },

  profitChart: {
    marginLeft: -24,
    marginBottom: -40,
  },

  profitChartDotText: {
    position: "absolute",
    fontSize: 10,
    padding: 4,
    color: "#1f2937",
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    fontWeight: "700",
  },
});

const stockStyles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
    shadowColor: '#af361eff',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 40,
  },
  headerWrapper: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  headerBadge: {
    backgroundColor: '#b91c1c',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    shadowColor: '#b91c1c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    maxHeight: 464,
    marginTop: 8,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  productDetail: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  stockRemaining: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    paddingVertical: 80,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerIcon: {
    fontSize: 25,
    color: '#e20000ff',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    flex: 1,
  },
});

const expirationStyles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 40,
  },
  headerWrapper: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  headerBadge: {
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  headerBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    maxHeight: 464,
    marginTop: 8,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  productDetail: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  batchNumber: {
    fontWeight: '700',
    color: '#1f2937',
  },
  daysLeft: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    paddingVertical: 80,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerIcon: {
    fontSize: 25,
    color: '#e20000ff',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    flex: 1,
  },
});

const topSellingStyle = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
    paddingTop: 50,
    width: '100%',
    marginTop: 40,
    marginBottom: 40,
    position: 'relative',
  },
  headerContainer: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#166534',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#ffffff',
  },
  headerSubtitle: {
    color: '#bbf7d0',
    fontSize: 14,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#166534',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  countLabel: {
    color: '#bbf7d0',
    fontSize: 14,
    marginLeft: 4,
  },
  scrollView: {
    maxHeight: 464,
    paddingHorizontal: 16,
    paddingTop: 16,
  },  
  scrollContent: {
    paddingBottom: 16,
  },
  bestSellerCard: {
    position: 'relative',
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 2,
    borderColor: '#facc15',
    backgroundColor: '#fffbeb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 12,
  },
  bestSellerBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#facc15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  bestSellerBadgeText: {
    color: '#78350f',
    fontWeight: '700',
    fontSize: 14,
  },
  productImage: {
    height: 64,
    width: 64,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
  },
  bestSellerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  bestSellerSold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  bestSellerSales: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803d',
  },
  regularCard: {
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  rankBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rankText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  regularName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  regularSold: {
    fontSize: 14,
    color: '#4b5563',
  },
  regularSales: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
});


const reportStyle = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  totalContainer: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    borderRadius: 4,
    padding: 14,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: -0.5,
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 12,
    maxWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
    minHeight: 50,
  },
  tableRowEven: {
    backgroundColor: '#ffffff',
  },
  tableRowOdd: {
    backgroundColor: '#f8fafc',
  },
  tableCellText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    lineHeight: 16,
  },
  columnProduct: {
    width: 100,
    paddingRight: 6,
  },
  columnQuantity: {
    width: 40,
    textAlign: 'center',
  },
  columnLoss: {
    width: 85,
    textAlign: 'right',
    paddingRight: 6,
  },
  columnReason: {
    width: 110,
    paddingLeft: 6,
  },
  lossAmount: {
    fontWeight: '700',
    color: '#dc2626',
    fontSize: 12,
  },
});


