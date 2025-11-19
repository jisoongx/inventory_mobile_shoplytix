import React, { useEffect, useState, useRef } from "react";
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  Dimensions, 
  TouchableOpacity, 
  SafeAreaView,
  Image,
  AppState
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from "react-native-chart-kit";
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [chartLoading, setChartLoading] = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview");
  
  // ✅ Polling interval refs
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const POLLING_INTERVAL = 30000; // 30 seconds (adjust as needed)

  const fetchDashboard = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      
      const ownerId = await AsyncStorage.getItem('owner_id');
      
      if (!silent) {
        console.log('=== DASHBOARD FETCH DEBUG ===');
        console.log('Owner ID:', ownerId);
      }
      
      if (!ownerId) {
        Alert.alert('Error', 'Please login first');
        return;
      }

      const url = `http://192.168.100.20:8000/api/dashboard?owner_id=${ownerId}&year=${selectedYear}`;
      
      if (!silent) {
        console.log('Fetching URL:', url);
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      if (!silent) {
        console.log('Response Status:', response.status);
        console.log('Response OK:', response.ok);
      }
      
      const contentType = response.headers.get('content-type');
      
      if (!silent) {
        console.log('Content-Type:', contentType);
      }
      
      const text = await response.text();
      
      if (!silent) {
        console.log('Raw Response (first 500 chars):', text.substring(0, 500));
      }
      
      let data;
      try {
        data = JSON.parse(text);
        if (!silent) {
          console.log('Parsed Data:', data);
        }
      } catch (parseError) {
        if (!silent) {
          console.error('JSON Parse Error:', parseError);
          console.log('Full Response Text:', text);
          Alert.alert('Error', 'Server returned invalid JSON. Check console.');
        }
        return;
      }
      
      if (response.ok && data.success) {
        if (!silent) {
          console.log('✅ Dashboard data loaded successfully');
        }
        setDashboardData(data);
      } else {
        if (!silent) {
          console.log('❌ Response not OK or success=false');
          Alert.alert('Error', data.message || 'Failed to fetch dashboard data.');
        }
      }
    } catch (error) {
      if (!silent) {
        console.error('=== DASHBOARD FETCH ERROR ===');
        console.error('Error Type:', error.constructor.name);
        console.error('Error Message:', error.message);
        console.error('Full Error:', error);
        Alert.alert('Error', `Unable to connect: ${error.message}`);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
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

  // ✅ Start polling
  const startPolling = () => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Set up new polling interval
    pollingIntervalRef.current = setInterval(() => {
      console.log('🔄 Polling dashboard data...');
      fetchDashboard(true); // silent = true (no loading indicator)
    }, POLLING_INTERVAL);

    console.log(`✅ Polling started (every ${POLLING_INTERVAL / 1000} seconds)`);
  };

  // ✅ Stop polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('⏹️ Polling stopped');
    }
  };

  // ✅ Handle app state changes (pause polling when app goes to background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App came to foreground - resuming polling');
        startPolling();
        fetchDashboard(true); // Fetch immediately when app becomes active
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('📱 App went to background - pausing polling');
        stopPolling();
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ✅ Initial fetch and start polling
  useEffect(() => {
    fetchDashboard(); // Initial fetch with loading indicator
    startPolling(); // Start polling

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, []);

  // ✅ Update polling when year changes
  useEffect(() => {
    stopPolling();
    startPolling();
  }, [selectedYear]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    fetchChartData(year);
  };

  // if (loading) {
  //   return (
  //     <View style={headerStyle.center}>
  //       <ActivityIndicator size="large" color="#b91c1c" />
  //       <Text>Loading dashboard...</Text>
  //     </View>
  //   );
  // }

  // if (!dashboardData) {
  //   return (
  //     <View style={headerStyle.center}>
  //       <Text style={{ color: "red" }}>No dashboard data available.</Text>
  //     </View>
  //   );
  // }

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
    stockAlert = [],
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
  const hasSalesLossData = sales.length > 0 && losses.length > 0 && (sales[sales.length - 1] !== 0 || losses[losses.length - 1] !== 0);
    
  const getStatusColor = (status) => {
    switch(status) {
      case 'Critical':
        return {
          border: '#EF4444',
          text: '#DC2626',
          dot: '#EF4444'
        };
      case 'Reorder':
        return {
          border: '#F97316',
          text: '#EA580C',
          dot: '#F97316'
        };
      case 'Normal':
        return {
          border: '#64748B',
          text: '#475569',
          dot: '#64748B'
        };
      default:
        return {
          border: '#E5E7EB',
          text: '#6B7280',
          dot: '#9CA3AF'
        };
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
                ₱{(Number(weeklySales) / 1000).toFixed(1)}k
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

          {/* monthly profit dapit */}
          <View style={profitStyle.profitCardContainer}>
            <Text style={profitStyle.profitCardHeader}>Monthly Net Profit</Text>
            <View style={profitStyle.profitCardContent}>
              <View style={profitStyle.profitDateContainer}>
                <Text style={profitStyle.profitMonthYear}>{month}</Text>
                <Text style={profitStyle.profitDayDate}>{day}</Text>
              </View>

              <View style={profitStyle.profitAmountContainer}>
                {profitMonth === null || profitMonth === 0 ? (
                  <Text style={profitStyle.profitEmptyText}>Empty database.</Text>
                ) : (
                  <Text style={profitStyle.profitAmount}>
                    {formatCurrency(profitMonth)}
                  </Text>
                )}
                <Text style={profitStyle.profitAmountLabel}>Current Net Profit</Text>
              </View>

              <View style={profitStyle.profitActionsContainer}>
                <View style={profitStyle.profitYearPickerContainer}>
                  <Picker
                    selectedValue={selectedYear}
                    onValueChange={handleYearChange}
                    style={profitStyle.profitYearPicker}
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
              <View style={profitStyle.profitChartLoadingContainer}>
                <ActivityIndicator size="small" color="#b91c1c" />
              </View>
            ) : (
              <View style={profitStyle.profitChartContainer}>
                <View style={profitStyle.profitChartWrapper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={profitStyle.profitChartScrollContent}
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
                      style={profitStyle.profitChart}
                      withVerticalLabels={true}  
                      withHorizontalLabels={false} 
                      fromZero={true}
                      segments={5}
                      renderDotContent={({ x, y, index }) => (
                        <Text
                          key={index}
                          style={[
                            profitStyle.profitChartDotText,
                            {
                              top: y - 35,
                              left: x - 20,
                            }
                          ]}
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
          <Text style={headerStyle.reportsTitle}>Reports View</Text>
          <Text style={headerStyle.reportsText}>Show reports-related charts here...</Text>
        </View>
      )}

    </ScrollView>
  </SafeAreaView>
);
}

const headerStyle = StyleSheet.create({
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

// sayop pa ni
const profitStyle = StyleSheet.create({
  profitCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 28,
    marginBottom: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#FEE2E2',
    position: 'relative',
    overflow: 'hidden',
  },
  profitCardHeader: {
    fontSize: 24,
    fontWeight: '900',
    color: '#DC2626',
    marginBottom: 24,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(220, 38, 38, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  profitCardContent: {
    backgroundColor: '#FEF2F2',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FECACA',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profitDateContainer: {
    backgroundColor: '#DC2626',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profitMonthYear: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4
  }

});