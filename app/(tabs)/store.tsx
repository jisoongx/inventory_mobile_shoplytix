import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, 
    StatusBar, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from "../constants";

export default function StoreScreen() {
    const [cart, setCart] = useState({});
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [amountPaid, setAmountPaid] = useState("");

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async (silent = false) => {
        try {
            if (!silent) setLoading(true);

            const ownerId = await AsyncStorage.getItem("owner_id");
            if (!ownerId) {
                Alert.alert("Error", "Please login first");
                return;
            }

            const res = await fetch(`${API}/products?owner_id=${ownerId}`);
            const textResponse = await res.text();
            const data = JSON.parse(textResponse);

            if (res.ok && data.success) {
                const cleaned = (data.products || []).map(p => ({
                    ...p,
                    prod_code: String(p.prod_code),   
                    selling_price: Number(p.selling_price) || 0,
                    stock: Number(p.stock) || 0,
                }));

                setProducts(cleaned);
            } else if (!silent) {
                Alert.alert("Error", data.message || "Failed to fetch products.");
            }

        } catch (error) {
            if (!silent) {
                console.error("Products fetch error:", error);
                Alert.alert("Error", "Unable to connect.");
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleProductClick = (prod_code) => {
        prod_code = String(prod_code);  // ← FIX #2 (ENSURE STRING)

        const product = products.find(p => p.prod_code === prod_code);
        if (!product) return;

        const currentQty = cart[prod_code] || 0;
        if (currentQty >= product.stock) {
            Alert.alert("Out of Stock", `Only ${product.stock} items available`);
            return;
        }

        setCart(prev => ({
            ...prev,
            [prod_code]: currentQty + 1
        }));
    };

    const getTotalItems = () => {
        return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    };

    const getTotalAmount = () => {
        return Object.entries(cart).reduce((sum, [code, qty]) => {
            const product = products.find(p => p.prod_code === code);
            return sum + ((product?.selling_price || 0) * qty);
        }, 0);
    };

    const selectedProducts = () => {
        return Object.entries(cart).map(([code, qty]) => {
            const product = products.find(p => p.prod_code === code);

            if (!product) {
                return {
                    prod_code: `missing-${code}`,
                    prod_name: "(Unknown Product)",
                    selling_price: 0,
                    quantity: qty
                };
            }

            return { ...product, quantity: qty };
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={styles.loadingText}>Loading products...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (products.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No products available</Text>
                    <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={() => fetchProducts()}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }


const confirmOrder = async () => {
    const ownerId = await AsyncStorage.getItem("owner_id");
    const totalAmount = getTotalAmount();

    // Add validation for amount paid
    if (!amountPaid || Number(amountPaid) < totalAmount) {
        Alert.alert("Invalid Payment", `Amount paid (₱${Number(amountPaid).toFixed(2)}) is less than total (₱${totalAmount.toFixed(2)})`);
        return;
    }

    const items = selectedProducts()
        .filter(item => !item.prod_code.startsWith('missing-')) // Filter out missing products
        .map(item => ({
            prod_code: Number(item.prod_code), // Ensure it's a number
            quantity: Number(item.quantity)
        }));

    // Check if we have valid items
    if (items.length === 0) {
        Alert.alert("Error", "No valid items in cart");
        return;
    }

    try {
        console.log("Sending checkout data:", {
            owner_id: Number(ownerId),
            amount_paid: Number(amountPaid),
            items
        });

        const res = await fetch(`${API}/store/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner_id: Number(ownerId),
                amount_paid: Number(amountPaid),
                items
            })
        });

        const textResponse = await res.text();
        console.log("Raw response:", textResponse);
        
        const data = JSON.parse(textResponse);

        if (data.success) {
            Alert.alert("Success", "Order processed!");
            fetchProducts(true);
            setAmountPaid("");
            setCart({});
            setModalVisible(false);
        } else {
            Alert.alert("Error", data.message || "Checkout failed");
        }
    } catch (error) {
        console.error("Checkout error:", error);
        Alert.alert("Error", "Cannot connect to server");
    }
};

     
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f7" />

            {/* Header */}
            <View style={styles.header}>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.productGrid}>
                    {products.map(product => {
                        const quantity = cart[product.prod_code] || 0;
                        const isSelected = quantity > 0;
                        const outOfStock = product.stock === 0;

                        return (
                            <TouchableOpacity
                                key={product.prod_code}
                                style={[
                                    styles.productCard,
                                    isSelected && styles.productCardSelected,
                                    outOfStock && styles.productCardDisabled
                                ]}
                                onPress={() => handleProductClick(product.prod_code)}
                                activeOpacity={0.8}
                                disabled={outOfStock}
                            >
                                {isSelected && (
                                    <View style={styles.quantityBadge}>
                                        <Text style={styles.quantityText}>{quantity}</Text>
                                    </View>
                                )}

                                {outOfStock && (
                                    <View style={styles.outOfStockOverlay}>
                                        <Text style={styles.outOfStockText}>Out of stock</Text>
                                    </View>
                                )}

                                <View style={styles.productImagePlaceholder}>
                                    <Text style={styles.productEmoji}>🛍️</Text>
                                </View>

                                <View style={styles.productInfo}>
                                    <Text style={styles.productName} numberOfLines={2}>
                                        {product.prod_name}
                                    </Text>
                                    <View style={styles.priceRow}>
                                        <Text style={styles.productPrice}>
                                            ₱{product.selling_price.toFixed(2)}
                                        </Text>
                                        <Text style={styles.stockText}>
                                            {product.stock} left
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <View style={styles.bottomPadding} />
            </ScrollView>

            {getTotalItems() > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={styles.checkoutButton}
                        onPress={() => setModalVisible(true)}
                        activeOpacity={0.9}
                    >
                        <View style={styles.checkoutContent}>
                            <View>
                                <Text style={styles.checkoutItems}>
                                    {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'items'}
                                </Text>
                                <Text style={styles.checkoutAmount}>
                                    ₱{getTotalAmount().toFixed(2)}
                                </Text>
                            </View>
                            <View style={styles.checkoutIcon}>
                                <Text style={styles.checkoutIconText}>→</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Your Cart</Text>
                            <TouchableOpacity
                                style={styles.modalCloseIcon}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.modalCloseIconText}>×</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                            {selectedProducts().map((item, index) => (
                                <View key={`${item.prod_code}-${index}`} style={styles.modalItem}>
                                    <View style={styles.modalItemLeft}>
                                        <Text style={styles.modalItemName}>{item.prod_name}</Text>
                                        <Text style={styles.modalItemQty}>Quantity: {item.quantity}</Text>
                                    </View>
                                    <Text style={styles.modalItemPrice}>
                                        ₱{(item.selling_price * item.quantity).toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total</Text>
                                <Text style={styles.totalAmount}>
                                    ₱{getTotalAmount().toFixed(2)}
                                </Text>
                            </View>
                            <View style={{ marginBottom: 10 }}>
                                <Text style={{ fontSize: 16, marginBottom: 5 }}>Amount Paid</Text>
                                <TextInput
                                    style={{
                                        borderWidth: 1,
                                        borderColor: "#ccc",
                                        padding: 10,
                                        borderRadius: 8
                                    }}
                                    keyboardType="numeric"
                                    value={amountPaid}
                                    onChangeText={setAmountPaid}
                                    placeholder="Enter amount"
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={confirmOrder}
                            >
                                <Text style={styles.confirmButtonText}>Confirm Order</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#faf9f7' 
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        backgroundColor: '#faf9f7',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#2d2d2d',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#8b8b8b',
        marginTop: 4,
    },
    content: { 
        flex: 1,
    },
    productGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        paddingHorizontal: 16,
        gap: 12,
    },
    productCard: { 
        width: '47.5%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    productCardSelected: { 
        borderColor: '#d4c5b9',
        backgroundColor: '#fffcf9',
    },
    productCardDisabled: { 
        opacity: 0.4,
    },
    productImagePlaceholder: {
        width: '100%',
        aspectRatio: 1.2,
        backgroundColor: '#f5f3f0',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    productEmoji: {
        fontSize: 32,
    },
    productInfo: { 
        gap: 6,
    },
    productName: { 
        fontSize: 14,
        fontWeight: '600',
        color: '#2d2d2d',
        lineHeight: 18,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    productPrice: { 
        fontSize: 15,
        fontWeight: '700',
        color: '#6b5d54',
    },
    stockText: { 
        fontSize: 12,
        color: '#a8a8a8',
        fontWeight: '500',
    },
    quantityBadge: { 
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#6b5d54',
        borderRadius: 20,
        minWidth: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    quantityText: { 
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    outOfStockOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    outOfStockText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b8b8b',
        letterSpacing: 0.5,
    },
    footer: { 
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#faf9f7',
        borderTopWidth: 1,
        borderTopColor: '#f0ede8',
    },
    checkoutButton: { 
        backgroundColor: '#6b5d54',
        borderRadius: 16,
        shadowColor: '#6b5d54',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    checkoutContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
    },
    checkoutItems: {
        color: '#e8e0d8',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 2,
    },
    checkoutAmount: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 20,
    },
    checkoutIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkoutIconText: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '600',
    },
    bottomPadding: {
        height: 20,
    },
    modalOverlay: { 
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: { 
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingTop: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    modalTitle: { 
        fontSize: 22,
        fontWeight: '700',
        color: '#2d2d2d',
    },
    modalCloseIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f5f3f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCloseIconText: {
        fontSize: 24,
        color: '#8b8b8b',
        fontWeight: '300',
    },
    modalList: { 
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    modalItem: { 
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    modalItemLeft: {
        flex: 1,
        marginRight: 16,
    },
    modalItemName: { 
        fontSize: 15,
        color: '#2d2d2d',
        fontWeight: '600',
        marginBottom: 4,
    },
    modalItemQty: { 
        fontSize: 13,
        color: '#a8a8a8',
        fontWeight: '500',
    },
    modalItemPrice: { 
        fontSize: 16,
        fontWeight: '700',
        color: '#6b5d54',
    },
    modalFooter: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#8b8b8b',
    },
    totalAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2d2d2d',
    },
    confirmButton: { 
        backgroundColor: '#6b5d54',
        paddingVertical: 16,
        borderRadius: 14,
        shadowColor: '#6b5d54',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmButtonText: { 
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 16,
        textAlign: 'center',
        letterSpacing: 0.3,
    },
});