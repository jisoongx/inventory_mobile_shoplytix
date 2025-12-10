import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, 
    StatusBar, Alert, ActivityIndicator, Modal, TextInput, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from "../constants";
import BarcodeScanner from '../BarcodeScanner';

// TypeScript Interfaces
interface Product {
    prod_code: string;
    barcode: string;
    prod_name: string;
    prod_image: string;
    selling_price: number;
    stock:  number;
}

interface CartType {
    [prod_code:  string]: number;
}

export default function StoreScreen() {
    const [cart, setCart] = useState<CartType>({});
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [amountPaid, setAmountPaid] = useState("");
    const [barcodeInput, setBarcodeInput] = useState("");
    const [cameraScannerVisible, setCameraScannerVisible] = useState(false);
    const barcodeInputRef = useRef<TextInput>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    // Auto-focus barcode input when screen loads
    useEffect(() => {
        if (! modalVisible && ! cameraScannerVisible && barcodeInputRef.current) {
            setTimeout(() => {
                barcodeInputRef.current?.focus();
            }, 100);
        }
    }, [modalVisible, cameraScannerVisible]);

    const fetchProducts = async (silent = false) => {
        try {
            if (! silent) setLoading(true);

            const ownerId = await AsyncStorage.getItem("owner_id");
            if (!ownerId) {
                Alert.alert("Error", "Please login first");
                return;
            }

            const res = await fetch(`${API}/products? owner_id=${ownerId}`);
            const textResponse = await res.text();
            const data = JSON.parse(textResponse);

            if (res.ok && data.success) {
                const cleaned = (data.products || []).map((p: any) => ({
                    ...p,
                    prod_code: String(p.prod_code),
                    barcode: String(p.barcode || ''),
                    selling_price: Number(p.selling_price) || 0,
                    stock: Number(p.stock) || 0,
                }));

                setProducts(cleaned);
                console.log(`Loaded ${cleaned.length} products`);
            } else if (! silent) {
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

    // Handle barcode scan - Uses barcode column
    const handleBarcodeScan = (scannedBarcode: string) => {
        if (! scannedBarcode || scannedBarcode.trim() === "") return;

        const trimmedBarcode = scannedBarcode.trim();
        
        // Find product by barcode column, not prod_code
        const product = products.find(p => p.barcode === trimmedBarcode);

        if (! product) {
            Alert.alert("Product Not Found", `No product with barcode: ${trimmedBarcode}`);
            setBarcodeInput("");
            return;
        }

        // Use prod_code for cart operations
        const currentQty = cart[product.prod_code] || 0;
        if (currentQty >= product.stock) {
            Alert.alert("Out of Stock", `Only ${product.stock} items available for ${product.prod_name}`);
            setBarcodeInput("");
            return;
        }

        // Add to cart using prod_code as key
        setCart(prev => ({
            ... prev,
            [product.prod_code]: currentQty + 1
        }));

        // Show success message
        Alert.alert(
            "Added to Cart",
            `${product.prod_name}\n₱${product.selling_price.toFixed(2)}`,
            [{ text: "OK" }],
            { cancelable: true }
        );

        // Clear input for next scan
        setBarcodeInput("");
        
        // Refocus input for continuous scanning
        setTimeout(() => {
            if (barcodeInputRef.current) {
                barcodeInputRef.current.focus();
            }
        }, 100);
    };

    const handleProductClick = (prod_code: string) => {
        prod_code = String(prod_code);

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

    // Remove item from cart
    const removeFromCart = (prod_code: string) => {
        setCart(prev => {
            const newCart = { ...prev };
            if (newCart[prod_code] > 1) {
                newCart[prod_code] -= 1;
            } else {
                delete newCart[prod_code];
            }
            return newCart;
        });
    };

    // Clear entire cart
    const clearCart = () => {
        if (Object.keys(cart).length === 0) {
            Alert.alert("Cart Empty", "Your cart is already empty");
            return;
        }
        
        setCart({});
        Alert.alert("Success", "Cart cleared successfully");
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

            if (! product) {
                return {
                    prod_code: `missing-${code}`,
                    prod_name: "(Unknown Product)",
                    barcode: "",
                    prod_image: "",
                    selling_price: 0,
                    stock: 0,
                    quantity: qty
                };
            }

            return { ... product, quantity: qty };
        });
    };

    const confirmOrder = async () => {
        const ownerId = await AsyncStorage.getItem("owner_id");
        const totalAmount = getTotalAmount();

        if (!amountPaid || Number(amountPaid) < totalAmount) {
            Alert.alert("Invalid Payment", `Amount paid (₱${Number(amountPaid).toFixed(2)}) is less than total (₱${totalAmount.toFixed(2)})`);
            return;
        }

        const items = selectedProducts()
            .filter(item => ! item.prod_code.startsWith('missing-'))
            .map(item => ({
                prod_code: Number(item.prod_code),
                quantity: Number(item.quantity)
            }));

        if (items.length === 0) {
            Alert.alert("Error", "No valid items in cart");
            return;
        }

        try {
            console.log("Sending checkout data:", {
                owner_id:  Number(ownerId),
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
                const change = Number(amountPaid) - totalAmount;
                Alert.alert(
                    "Success", 
                    `Order processed!\n\nTotal: ₱${totalAmount.toFixed(2)}\nPaid: ₱${Number(amountPaid).toFixed(2)}\nChange: ₱${change.toFixed(2)}`,
                    [{ text: "OK" }]
                );
                fetchProducts(true);
                setAmountPaid("");
                setCart({});
                setModalVisible(false);
                
                // Refocus scanner
                setTimeout(() => {
                    if (barcodeInputRef.current) {
                        barcodeInputRef.current.focus();
                    }
                }, 500);
            } else {
                Alert.alert("Error", data.message || "Checkout failed");
            }
        } catch (error) {
            console.error("Checkout error:", error);
            Alert.alert("Error", "Cannot connect to server");
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6b5d54" />
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

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f7" />

            {/* Header with Scanner */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerSubtitle}>
                            {products.length} products • {getTotalItems()} in cart
                        </Text>
                    </View>
                    {getTotalItems() > 0 && (
                        <TouchableOpacity 
                            style={styles.clearCartButton}
                            onPress={clearCart}
                        >
                            <Text style={styles.clearCartText}>Clear Cart</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Barcode Scanner Input - SUPPORTS BOTH HARDWARE & CAMERA */}
                <View style={styles.scannerContainer}>
                    <View style={styles.scannerIcon}>
                        <Text style={styles.scannerIconText}>🔍︎</Text>
                    </View>
                    <TextInput
                        ref={barcodeInputRef}
                        style={styles.barcodeInput}
                        placeholder="Scan or enter barcode..."
                        value={barcodeInput}
                        onChangeText={setBarcodeInput}
                        onSubmitEditing={() => handleBarcodeScan(barcodeInput)}
                        returnKeyType="done"
                        autoCapitalize="none"
                        autoCorrect={false}
                        blurOnSubmit={false}
                    />
                    {barcodeInput !== "" && (
                        <TouchableOpacity 
                            style={styles.clearInputButton}
                            onPress={() => setBarcodeInput("")}
                        >
                            <Text style={styles.clearInputText}>×</Text>
                        </TouchableOpacity>
                    )}
                    {/* Camera Scanner Button */}
                    <TouchableOpacity 
                        style={styles.cameraButton}
                        onPress={() => setCameraScannerVisible(true)}
                    >
                        <Text style={styles.cameraButtonText}>[◉°]</Text>
                    </TouchableOpacity>
                </View>
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

                                <View style={styles.productImageContainer}>
                                    <Image
                                        source={{ uri:  product.prod_image || 'https://via.placeholder.com/150' }}
                                        style={styles.productImage}
                                        resizeMode="cover"
                                    />
                                </View>

                                <View style={styles.productInfo}>
                                    {product.barcode && (
                                        <Text style={styles.productBarcode}>{product.barcode}</Text>
                                    )}
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

            {/* Camera Scanner Modal */}
            <BarcodeScanner
                visible={cameraScannerVisible}
                onClose={() => setCameraScannerVisible(false)}
                onBarcodeScan={(barcode:  string) => {
                    setCameraScannerVisible(false);
                    handleBarcodeScan(barcode);
                }}
            />

            {/* Enhanced Checkout Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Checkout</Text>
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
                                        <Text style={styles.modalItemQty}>
                                            ₱{item.selling_price.toFixed(2)} × {item.quantity}
                                        </Text>
                                    </View>
                                    <View style={styles.modalItemRight}>
                                        <Text style={styles.modalItemPrice}>
                                            ₱{(item.selling_price * item.quantity).toFixed(2)}
                                        </Text>
                                        <View style={styles.quantityControls}>
                                            <TouchableOpacity 
                                                style={styles.qtyButton}
                                                onPress={() => removeFromCart(item.prod_code)}
                                            >
                                                <Text style={styles.qtyButtonText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.qtyDisplay}>{item.quantity}</Text>
                                            <TouchableOpacity 
                                                style={styles.qtyButton}
                                                onPress={() => handleProductClick(item.prod_code)}
                                            >
                                                <Text style={styles.qtyButtonText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total Amount</Text>
                                <Text style={styles.totalAmount}>
                                    ₱{getTotalAmount().toFixed(2)}
                                </Text>
                            </View>
                            
                            <View style={styles.paymentSection}>
                                <Text style={styles.paymentLabel}>Amount Paid</Text>
                                <TextInput
                                    style={styles.paymentInput}
                                    keyboardType="numeric"
                                    value={amountPaid}
                                    onChangeText={setAmountPaid}
                                    placeholder="Enter amount"
                                    placeholderTextColor="#a8a8a8"
                                />
                                
                                {/* Quick amount buttons */}
                                <View style={styles.quickAmountButtons}>
                                    {[100, 200, 500, 1000].map(amount => (
                                        <TouchableOpacity
                                            key={amount}
                                            style={styles.quickAmountButton}
                                            onPress={() => setAmountPaid(String(amount))}
                                        >
                                            <Text style={styles.quickAmountText}>₱{amount}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    <TouchableOpacity
                                        style={[styles.quickAmountButton, styles.exactButton]}
                                        onPress={() => setAmountPaid(String(getTotalAmount()))}
                                    >
                                        <Text style={[styles.quickAmountText, styles.exactButtonText]}>Exact</Text>
                                    </TouchableOpacity>
                                </View>

                                {amountPaid && Number(amountPaid) >= getTotalAmount() && (
                                    <View style={styles.changeRow}>
                                        <Text style={styles.changeLabel}>Change</Text>
                                        <Text style={styles.changeAmount}>
                                            ₱{(Number(amountPaid) - getTotalAmount()).toFixed(2)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={confirmOrder}
                            >
                                <Text style={styles.confirmButtonText}>Complete Payment</Text>
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
        paddingBottom: 12,
        backgroundColor: '#faf9f7',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
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
    clearCartButton: {
        backgroundColor: '#ff4444',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    clearCartText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    scannerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical:  4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 2,
        borderColor: '#6b5d54',
    },
    scannerIcon: {
        marginRight: 8,
    },
    scannerIconText: {
        fontSize: 24,
    },
    barcodeInput:  {
        flex: 1,
        fontSize: 16,
        color:  '#2d2d2d',
        paddingVertical: 12,
        fontWeight: '500',
    },
    clearInputButton: {
        padding: 4,
        marginRight: 8,
    },
    clearInputText: {
        fontSize: 28,
        color: '#8b8b8b',
        fontWeight: '300',
    },
    cameraButton: {
        backgroundColor: '#6b5d54',
        padding: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraButtonText:  {
        fontSize: 20,
    },
    content: { 
        flex: 1,
    },
    productGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 12,
    },
    productCard: { 
        width: '47.5%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity:  0.06,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    productCardSelected: { 
        borderColor: '#6b5d54',
        backgroundColor: '#fffcf9',
    },
    productCardDisabled: { 
        opacity: 0.4,
    },
    productImageContainer: {
        width: '100%',
        aspectRatio: 1.2,
        backgroundColor: '#f5f3f0',
        borderRadius:  12,
        overflow: 'hidden',
        marginBottom: 8,
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    productInfo: { 
        gap: 4,
    },
    productBarcode: {
        fontSize: 10,
        color: '#a8a8a8',
        fontWeight: '600',
        marginBottom: 2,
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
        marginTop: 4,
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
        right:  0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems:  'center',
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
        shadowOpacity:  0.25,
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
        alignItems:  'center',
    },
    checkoutIconText: {
        color: '#ffffff',
        fontSize:  20,
        fontWeight:  '600',
    },
    bottomPadding: {
        height: 20,
    },
    loadingContainer: {
        flex:  1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#8b8b8b',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems:  'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 18,
        color: '#8b8b8b',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor:  '#6b5d54',
        paddingHorizontal: 24,
        paddingVertical:  12,
        borderRadius:  12,
    },
    retryButtonText:  {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
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
        maxHeight: 250,
    },
    modalItem: { 
        flexDirection:  'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth:  1,
        borderBottomColor: '#f5f5f5',
    },
    modalItemLeft: {
        flex: 1,
        marginRight: 16,
    },
    modalItemName: { 
        fontSize:  15,
        color: '#2d2d2d',
        fontWeight: '600',
        marginBottom: 4,
    },
    modalItemQty:  { 
        fontSize: 13,
        color: '#a8a8a8',
        fontWeight: '500',
    },
    modalItemRight: {
        alignItems: 'flex-end',
    },
    modalItemPrice: { 
        fontSize: 16,
        fontWeight: '700',
        color: '#6b5d54',
        marginBottom: 8,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    qtyButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f5f3f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyButtonText:  {
        fontSize: 18,
        fontWeight: '600',
        color: '#6b5d54',
    },
    qtyDisplay: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2d2d2d',
        minWidth: 24,
        textAlign: 'center',
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
    paymentSection: {
        marginBottom: 16,
    },
    paymentLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2d2d2d',
        marginBottom: 8,
    },
    paymentInput: {
        borderWidth: 1,
        borderColor: '#d4c5b9',
        padding: 14,
        borderRadius: 12,
        fontSize: 18,
        fontWeight: '600',
        color: '#2d2d2d',
        backgroundColor: '#faf9f7',
    },
    quickAmountButtons: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    quickAmountButton: {
        flex: 1,
        backgroundColor: '#f5f3f0',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    exactButton: {
        backgroundColor: '#6b5d54',
    },
    quickAmountText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2d2d2d',
    },
    exactButtonText: {
        color: '#ffffff',
    },
    changeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    changeLabel: {
        fontSize:  15,
        fontWeight: '500',
        color: '#8b8b8b',
    },
    changeAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#27ae60',
    },
    confirmButton: { 
        backgroundColor: '#6b5d54',
        paddingVertical: 16,
        borderRadius: 14,
        shadowColor: '#6b5d54',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity:  0.2,
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