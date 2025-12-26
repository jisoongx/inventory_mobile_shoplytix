import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API } from "../constants";

interface Category {
  category_id: number;
  category_name: string;
}

interface Product {
  prod_code: number;
  barcode: string;
  name: string;
  cost_price: number;
  selling_price: number;
  stock_limit: number;
  prod_image: string | null;
  unit: string;
  category_name?: string;
  category_id?: number;
  prod_status: string;
  current_stock: number;
}

export default function InventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchInventoryData(), fetchCategories()]);
  };

  const fetchInventoryData = async () => {
    try {
      const ownerId = await AsyncStorage.getItem("owner_id");
      if (!ownerId) {
        Alert.alert("Error", "owner_id missing. Please login again.");
        return;
      }

      const url = `${API}/inventory?owner_id=${ownerId}`;
      console.log("Fetching from:", url);
      const response = await fetch(url);

      if (!response.ok) {
        console.error("Inventory fetch failed:", response.status);
        throw new Error("HTTP error " + response.status);
      }

      const data = await response.json();
      console.log("Inventory response:", data);
      console.log("Products count:", data.products?.length);

      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
        console.log("Products set:", data.products.length);
      } else {
        console.warn("No products in response");
        setProducts([]);
      }
    } catch (error) {
      console.error("Inventory fetch error:", error);
      Alert.alert("Error", "Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const ownerId = await AsyncStorage.getItem("owner_id");
      if (!ownerId) return;

      const url = `${API}/inventory/categories?owner_id=${ownerId}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error("Categories fetch failed:", response.status);
        return;
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
        console.log("Categories loaded:", data.categories.length);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const getRowStatus = (item: Product) => {
    if (item.current_stock <= 0) return "out_of_stock";
    if (item.current_stock <= item.stock_limit) return "low_stock";
    return "healthy";
  };

  const openQuickRestock = (product: Product) => {
    console.log("Quick Restock:", product.prod_code);
  };

  const filteredProducts = products.filter((p) => {
    // Status filter
    const status = getRowStatus(p);
    const matchesStatus = statusFilter === "all" || statusFilter === status;

    // Category filter
    const matchesCategory =
      categoryFilter === "all" ||
      (p.category_id && p.category_id.toString() === categoryFilter);

    // Search filter
    const matchesSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesCategory && matchesSearch;
  });

  const clearSearch = () => {
    setSearchQuery("");
  };

  const getStatusLabel = () => {
    switch (statusFilter) {
      case "out_of_stock":
        return "Out of Stock";
      case "low_stock":
        return "Low Stock";
      case "healthy":
        return "Healthy";
      default:
        return "All";
    }
  };

  const getCategoryLabel = () => {
    if (categoryFilter === "all") return "All";
    const cat = categories.find((c) => c.category_id.toString() === categoryFilter);
    return cat ? cat.category_name : "All";
  };

  const renderCard = ({ item }: { item: Product }) => {
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
            <Text style={styles.stockLimit}>Min: {item.stock_limit}</Text>
          )}
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
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or barcode..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <MaterialIcons name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters Row */}
        <View style={styles.filtersRow}>
          {/* Status Filter */}
          <View style={styles.filterWrapper}>
            <Text style={styles.filterLabel}>Status</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowStatusModal(true)}
            >
              <MaterialIcons name="filter-list" size={16} color="#666" />
              <Text style={styles.filterButtonText}>{getStatusLabel()}</Text>
              <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Category Filter */}
          <View style={styles.filterWrapper}>
            <Text style={styles.filterLabel}>Category</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowCategoryModal(true)}
            >
              <MaterialIcons name="category" size={16} color="#666" />
              <Text style={styles.filterButtonText} numberOfLines={1}>
                {getCategoryLabel()}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Results Count */}
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
          </Text>
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
              {searchQuery !== ""
                ? "No matches for your search"
                : statusFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your filters"
                : "Start by adding products to your inventory"}
            </Text>
          </View>
        }
      />

      {/* Status Filter Modal */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {[
                { value: "all", label: "All Products" },
                { value: "out_of_stock", label: "Out of Stock" },
                { value: "low_stock", label: "Low Stock" },
                { value: "healthy", label: "Healthy Stock" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalItem}
                  onPress={() => {
                    setStatusFilter(option.value);
                    setShowStatusModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      statusFilter === option.value && styles.modalItemTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {statusFilter === option.value && (
                    <MaterialIcons name="check" size={20} color="#960204" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Filter Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setCategoryFilter("all");
                  setShowCategoryModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    categoryFilter === "all" && styles.modalItemTextActive,
                  ]}
                >
                  All Categories
                </Text>
                {categoryFilter === "all" && (
                  <MaterialIcons name="check" size={20} color="#960204" />
                )}
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.category_id}
                  style={styles.modalItem}
                  onPress={() => {
                    setCategoryFilter(cat.category_id.toString());
                    setShowCategoryModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      categoryFilter === cat.category_id.toString() &&
                        styles.modalItemTextActive,
                    ]}
                  >
                    {cat.category_name}
                  </Text>
                  {categoryFilter === cat.category_id.toString() && (
                    <MaterialIcons name="check" size={20} color="#960204" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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

  /* SEARCH BAR */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "500",
    paddingVertical: Platform.OS === "android" ? 8 : 0,
  },
  clearButton: {
    padding: 4,
  },

  /* FILTERS */
  filtersRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  filterWrapper: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
    marginLeft: 4,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 8,
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "100%",
    maxHeight: "70%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  modalItemText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  modalItemTextActive: {
    color: "#960204",
    fontWeight: "700",
  },

  /* RESULTS COUNT */
  resultsContainer: {
    paddingVertical: 8,
    alignItems: "center",
  },
  resultsText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
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
    fontWeight: "600",
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
    fontWeight: "500",
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