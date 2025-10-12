import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, Dimensions, TouchableOpacity, SafeAreaView } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from "react-native-chart-kit";
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [chartLoading, setChartLoading] = useState(false);
  const screenWidth = Dimensions.get("window").width;

  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview");

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const ownerId = await AsyncStorage.getItem('owner_id');
      
      if (!ownerId) {
        Alert.alert('Error', 'Please login first');
        return;
      }

      const response = await fetch(
        `http://192.168.100.20:8000/api/dashboard?owner_id=${ownerId}&year=${selectedYear}`
      );
      
      const data = await response.json();
      if (response.ok && data.success) {
        setDashboardData(data);
      } else {
        Alert.alert('Error', data.message || 'Failed to fetch dashboard data.');
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      Alert.alert('Error', 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async (year: number) => {
    try {
      setChartLoading(true);
      const ownerId = await AsyncStorage.getItem('owner_id');
      
      const response = await fetch(
        `http://192.168.100.20:8000/api/dashboard?owner_id=${ownerId}&year=${year}`
      );
      
      const data = await response.json();
      if (response.ok && data.success) {
        setDashboardData(prev => ({
          ...prev,
          profitMonth: data.profitMonth,
          profits: data.profits,
          months: data.months,
        }));
      }
    } catch (error) {
      console.error('Chart fetch error:', error);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    fetchChartData(year);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#b91c1c" />
        <Text>Loading dashboard...</Text>
      </View>
    );
  }

  if (!dashboardData) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>No dashboard data available.</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === 0) return '₱0.00';
    return `₱${amount.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const {
    owner_name,
    dailySales = 0,
    weeklySales = 0,
    monthSales = 0,
    profitMonth = 0,
    profits = [],
    months = [],
    year = [],
    categories = [],
    products = [],
    productsPrev = [],
    productsAveData = [],
    losses = [],
    sales = [],
  } = dashboardData || {};

  const dateDisplay = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const day = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    day: 'numeric',
    timeZone: 'Asia/Manila'
  });

  const month = new Date().toLocaleDateString('en-US', { 
    month: 'long',
    timeZone: 'Asia/Manila'
  });

  const hasCategoryData = categories.length > 0 && products.length > 0;
  const hasSalesLossData = sales.length > 0 && losses.length > 0 && 
    (sales[sales.length - 1] !== 0 || losses[losses.length - 1] !== 0);
    
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>

      <View style={styles.tabButtonContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "overview" && styles.tabButtonActive]}
          onPress={() => setActiveTab("overview")}
        >
          <Text style={[styles.tabButtonText, activeTab === "overview" && styles.tabButtonTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "reports" && styles.tabButtonActive]}
          onPress={() => setActiveTab("reports")}
        >
          <Text style={[styles.tabButtonText, activeTab === "reports" && styles.tabButtonTextActive]}>
            Reports
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "overview" ? (
        <View>
          <Text style={styles.dateText}>{dateDisplay}</Text>
          <Text style={styles.welcome}>Welcome, {owner_name}!</Text>

          <View style={styles.salesContainer}>
            <View style={[styles.card, styles.borderDarkRed, styles.leftCard]}>
              <Text style={[styles.salesValueBig, styles.textDarkRed]}>
                ₱{Number(dailySales).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.salesLabel}>Daily Sales</Text>
            </View>

            <View style={styles.rightColumn}>
              <View style={[styles.card, styles.borderRed]}>
                <Text style={[styles.salesValue, styles.textRed]}>
                  ₱{(Number(weeklySales) / 1000).toFixed(1)}k
                </Text>
                <Text style={styles.salesLabel}>Last 7 Days</Text>
              </View>

              <View style={[styles.card, styles.borderLightRed]}>
                <Text style={[styles.salesValue, styles.textLightRed]}>
                  ₱{(Number(monthSales) / 1000).toFixed(1)}k
                </Text>
                <Text style={styles.salesLabel}>This Month's Sales</Text>
              </View>
            </View>
          </View>
        
          <View style={styles.profitCardContainer}>
            <Text style={styles.profitCardHeader}>Monthly Net Profit</Text>
            <View style={styles.profitCardContent}>
              <View style={styles.profitDateContainer}>
                <Text style={styles.profitMonthYear}>{month}</Text>
                <Text style={styles.profitDayDate}>{day}</Text>
              </View>

              <View style={styles.profitAmountContainer}>
                {profitMonth === null || profitMonth === 0 ? (
                  <Text style={styles.profitEmptyText}>Empty database.</Text>
                ) : (
                  <Text style={styles.profitAmount}>
                    {formatCurrency(profitMonth)}
                  </Text>
                )}
                <Text style={styles.profitAmountLabel}>Current Net Profit</Text>
              </View>

              <View style={styles.profitActionsContainer}>
                <View style={styles.profitYearPickerContainer}>
                  <Picker
                    selectedValue={selectedYear}
                    onValueChange={handleYearChange}
                    style={styles.profitYearPicker}
                  >
                    {year.length > 0 ? (
                      year.map((y) => (
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

            {chartLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#b91c1c" />
              </View>
            ) : (
              <View style={{ marginTop: 15, marginBottom: -20 }}>
                <View
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    paddingBottom: 0,
                  }}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 0 }}
                  >
                    <LineChart
                      data={{
                        labels: months,
                        datasets: [
                          {
                            data: profits,
                          },
                        ],
                      }}
                      width={Math.max(screenWidth, months.length * 70)} 
                      height={450}
                      chartConfig={{
                        backgroundColor: "#ffffff",
                        backgroundGradientFrom: "#ffffff",
                        backgroundGradientTo: "#ffffff",
                        decimalPlaces: 2,
                        color: () => "#b91c1c",
                        labelColor: () => "#374151",
                        propsForDots: {
                          r: "5",
                          strokeWidth: "0.5",
                          stroke: "#b91c1c",
                        },
                        propsForBackgroundLines: {
                          stroke: "#c8921eff",
                        },
                        paddingBottom: 0,
                      }}
                      bezier
                      style={{
                        marginBottom: -40,
                        paddingBottom: 0,
                        marginLeft: -33,
                        marginTop: 20,
                      }}
                      withVerticalLabels={true}  
                      withHorizontalLabels={false} 
                      fromZero={true}
                      segments={5}
                      renderDotContent={({ x, y, index }) => (
                        <Text
                          key={index}
                          style={{
                            position: 'absolute',
                            fontSize: 10,
                            fontWeight: 'bold',
                            color: '#e04b00ff',
                            backgroundColor: '#fefee3ff',
                            borderRadius: 10,
                            borderWidth: 0.5,
                            padding: 5,
                            top: y - 35,
                            left: x - 20,
                          }}
                        >
                          {formatCurrency(profits[index])}
                        </Text>
                      )}
                    />
                  </ScrollView>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View>
          <Text style={{ fontSize: 18, fontWeight: "bold" }}>Reports View</Text>
          <Text>Show reports-related charts here...</Text>
        </View>
      )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f9fafb",
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: "#6b7280",
  },
  welcome: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopWidth: 4,
    borderRadius: 5,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  salesValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  salesLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  borderDarkRed: { borderTopColor: "#7f1d1d", borderWidth: 0.2},
  borderRed: { borderTopColor: "#b91c1c", borderWidth: 0.2 },
  borderLightRed: { borderTopColor: "#ef4444", borderWidth: 0.2 },
  textDarkRed: { color: "#7f1d1d" },
  textRed: { color: "#b91c1c" },
  textLightRed: { color: "#ef4444" },
  chartContainer: {
    backgroundColor: "#fff",
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    height: 260,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  salesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 8,
  },
  leftCard: {
    flex: 1.2, 
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
  },
  rightColumn: {
    flex: 1,
    justifyContent: "space-between",
    gap: 8,
  },
  salesValueBig: {
    fontSize: 26,
    fontWeight: "bold",
  },
  profitCardContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 0.3,
    borderColor: '#e5e7eb',
    marginTop: 10,
  },
  profitCardHeader: {
    textAlign: 'left',
    color: '#000000',
    fontWeight: '600',
    fontSize: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 15,
  },
  profitCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  profitDateContainer: {
    flexDirection: 'column',
    marginRight: 30,
  },
  profitMonthYear: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  profitDayDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  profitAmountContainer: {
    flexDirection: 'column',
    alignItems: 'flex-left',
  },
  profitEmptyText: {
    fontSize: 20,
    color: '#b91c1c',
  },
  profitAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  profitAmountLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  profitActionsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  profitYearPickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    minWidth: 100,
    height: 37, 
    justifyContent: 'center',
  },
  profitYearPicker: {
    height: 50, // Match container height
    width: '100%',
  },
  profitYearPickerText: {
    fontSize: 15,
  },
  tabButtonContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 7,
    marginHorizontal: 16,
    marginTop: 5,
    marginBottom: 15,
    borderWidth: 0.5,
    width: '100%',
    alignSelf: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#d0150bff',
    shadowColor: '#960204',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff', 
  },
});