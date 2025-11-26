import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API } from "../constants";

export default function InventoryScreen() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      const ownerId = await AsyncStorage.getItem("owner_id");
      if (!ownerId) {
        Alert.alert("Error", "owner_id missing. Please login again.");
        return;
      }

      const url = `${API}/inventory?owner_id=${ownerId}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error("HTTP error " + response.status);

      const data = await response.json();

      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      } else {
        setProducts([]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  const getRowStatus = (item) => {
    if (item.current_stock <= 0) return "out_of_stock";
    if (item.current_stock <= item.stock_limit) return "low_stock";
    return "healthy";
  };

  const openQuickRestock = (product) => {
    console.log("Quick Restock:", product.prod_code);
  };

  const filteredProducts = products.filter((p) => {
    const status = getRowStatus(p);
    return filter === "all" ? true : filter === status;
  });

  const renderCard = ({ item }) => {
    const status = getRowStatus(item);

    return (
      <TouchableOpacity
        style={[styles.card, styles[`card_${status}`]]}
        onPress={() => openQuickRestock(item)}
        activeOpacity={0.8}
      >
        {/* Left: Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: item.prod_image || "https://via.placeholder.com/100",
            }}
            style={styles.productImage}
          />
          {status !== "healthy" && (
            <View style={[styles.statusDot, styles[`dot_${status}`]]} />
          )}
        </View>

        {/* Middle: Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.barcodeRow}>
            <MaterialIcons name="qr-code-2" size={14} color="#999" />
            <Text style={styles.barcode} numberOfLines={1}>
              {item.barcode}
            </Text>
          </View>

          {/* Status Badge */}
          {status !== "healthy" && (
            <View style={[styles.statusBadge, styles[`badge_${status}`]]}>
              <MaterialIcons
                name={status === "out_of_stock" ? "error" : "warning"}
                size={12}
                color={status === "out_of_stock" ? "#d32f2f" : "#f57c00"}
              />
              <Text style={[styles.statusText, styles[`badgeText_${status}`]]}>
                {status === "out_of_stock" ? "Out of Stock" : "Low Stock"}
              </Text>
            </View>
          )}
        </View>

        {/* Right: Stock Info */}
        <View style={styles.stockSection}>
          <Text style={styles.stockLabel}>Stock</Text>
          <Text
            style={[
              styles.stockValue,
              status === "out_of_stock" && styles.stockValueDanger,
              status === "low_stock" && styles.stockValueWarning,
            ]}
          >
            {item.current_stock}
          </Text>
          {item.stock_limit > 0 && (
            <Text style={styles.stockLimit}>Limit: {item.stock_limit}</Text>
          )}

          <TouchableOpacity
            style={styles.restockButton}
            onPress={() => openQuickRestock(item)}
          >
            <MaterialIcons name="add-circle" size={28} color="#960204" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#960204" />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>

        <View style={styles.tipContainer}>
          <MaterialIcons name="touch-app" size={16} color="#666" />
          <Text style={styles.tip}>Tap any product to restock quickly.</Text>
        </View>

        {/* Filter */}
        <View style={styles.filterContainer}>
          <MaterialIcons name="filter-list" size={18} color="#666" />
          <Picker
            selectedValue={filter}
            style={styles.picker}
            onValueChange={(v) => setFilter(v)}
          >
            <Picker.Item label="All Products" value="all" />
            <Picker.Item label="Out of Stock" value="out_of_stock" />
            <Picker.Item label="Low Stock" value="low_stock" />
          </Picker>
        </View>
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderCard}
        keyExtractor={(item) => item.prod_code.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory" size={80} color="#ddd" />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>
              {filter !== "all"
                ? "Try adjusting your filters"
                : "Start by adding products to your inventory"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#777",
    fontWeight: "500",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },

  /* HEADER */
  header: {
    backgroundColor: "#fff",
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  countBadge: {
    backgroundColor: "#960204",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 44,
    alignItems: "center",
  },
  countText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0f7ff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  tip: {
    fontSize: 13,
    color: "#555",
    flex: 1,
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 14,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 8,
  },
  picker: {
    flex: 1,
    height: 46,
  },

  /* LIST */
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
  },

  /* CARD */
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderLeftWidth: 4,
  },
  card_healthy: {
    borderLeftColor: "#4caf50",
  },
  card_low_stock: {
    borderLeftColor: "#ff9800",
    backgroundColor: "#fffbf5",
  },
  card_out_of_stock: {
    borderLeftColor: "#f44336",
    backgroundColor: "#fff5f5",
  },

  /* IMAGE */
  imageContainer: {
    position: "relative",
    marginRight: 14,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
  },
  statusDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  dot_low_stock: {
    backgroundColor: "#ff9800",
  },
  dot_out_of_stock: {
    backgroundColor: "#f44336",
  },

  /* PRODUCT INFO */
  productInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  barcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  barcode: {
    fontSize: 12,
    color: "#999",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  badge_low_stock: {
    backgroundColor: "#fff3e0",
  },
  badge_out_of_stock: {
    backgroundColor: "#ffebee",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  badgeText_low_stock: {
    color: "#f57c00",
  },
  badgeText_out_of_stock: {
    color: "#d32f2f",
  },

  /* STOCK SECTION */
  stockSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: "#f0f0f0",
    minWidth: 90,
  },
  stockLabel: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stockValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#4caf50",
    marginBottom: 2,
  },
  stockValueWarning: {
    color: "#ff9800",
  },
  stockValueDanger: {
    color: "#f44336",
  },
  stockLimit: {
    fontSize: 10,
    color: "#aaa",
    marginBottom: 8,
  },
  restockButton: {
    padding: 4,
  },

  /* EMPTY STATE */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#555",
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
});