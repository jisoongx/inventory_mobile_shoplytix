import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, 
    StatusBar, Alert, ActivityIndicator, Modal, TextInput, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, CameraView } from 'expo-camera';
import { Search, X, Camera as CameraIcon, ShoppingCart, Trash2, Percent, DollarSign, PhilippinePeso } from 'lucide-react-native';

const API = "http://192.168.100.20:8082/api"; // Replace with your IP


export default function StoreScreen() {
    const [cart, setCart] = useState({});
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [amountPaid, setAmountPaid] = useState("");
    const [barcodeInput, setBarcodeInput] = useState("");
    const [cameraScannerVisible, setCameraScannerVisible] = useState(false);
    
    // Discount states
    const [receiptDiscountType, setReceiptDiscountType] = useState("none");
    const [receiptDiscountValue, setReceiptDiscountValue] = useState("");
    const [itemDiscounts, setItemDiscounts] = useState({});
    
    const barcodeInputRef = useRef(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (! modalVisible && ! cameraScannerVisible && barcodeInputRef.current) {
            setTimeout(() => {
                barcodeInputRef.current?.focus();
            }, 100);
        }
    }, [modalVisible, cameraScannerVisible]);

    const fetchProducts = async (silent = false) => {
        try {
            if (!silent) setLoading(true);

            const ownerId = await AsyncStorage.getItem("owner_id");
            if (!ownerId) {
                Alert.alert("Error", "Please login first");
                return;
            }

            const res = await fetch(`${API}/products? owner_id=${ownerId}`);
            const textResponse = await res.text();
            const data = JSON.parse(textResponse);

            if (res.ok && data.success) {
                const cleaned = (data.products || []).map(p => ({
                    ...p,
                    prod_code: String(p.prod_code),
                    barcode: String(p.barcode || ''),
                    selling_price: Number(p.selling_price) || 0,
                    cost_price: Number(p.cost_price) || 0,
                    stock:  Number(p.stock) || 0,
                    vat_category: p.vat_category || 'vat_inclusive',
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

    const handleBarcodeScan = (scannedBarcode) => {
        if (! scannedBarcode || scannedBarcode.trim() === "") return;

        const trimmedBarcode = scannedBarcode.trim();
        const product = products.find(p => p.barcode === trimmedBarcode);

        if (!product) {
            Alert.alert("Product Not Found", `No product with barcode:  ${trimmedBarcode}`);
            setBarcodeInput("");
            return;
        }

        const currentQty = cart[product.prod_code] || 0;
        if (currentQty >= product.stock) {
            Alert.alert("Out of Stock", `Only ${product.stock} items available for ${product.prod_name}`);
            setBarcodeInput("");
            return;
        }

        setCart(prev => ({
            ... prev,
            [product.prod_code]: currentQty + 1
        }));

        Alert.alert(
            "Added to Cart",
            `${product.prod_name}\n₱${product.selling_price.toFixed(2)}`,
            [{ text: "OK" }],
            { cancelable: true }
        );

        setBarcodeInput("");
        
        setTimeout(() => {
            if (barcodeInputRef.current) {
                barcodeInputRef.current.focus();
            }
        }, 100);
    };

    const handleProductClick = (prod_code) => {
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

    const removeFromCart = (prod_code) => {
        setCart(prev => {
            const newCart = { ...prev };
            if (newCart[prod_code] > 1) {
                newCart[prod_code] -= 1;
            } else {
                delete newCart[prod_code];
                setItemDiscounts(prevDiscounts => {
                    const newDiscounts = { ...prevDiscounts };
                    delete newDiscounts[prod_code];
                    return newDiscounts;
                });
            }
            return newCart;
        });
    };

    const clearCart = () => {
        if (Object.keys(cart).length === 0) {
            Alert.alert("Cart Empty", "Your cart is already empty");
            return;
        }
        
        setCart({});
        setItemDiscounts({});
        setReceiptDiscountType("none");
        setReceiptDiscountValue("");
        Alert.alert("Success", "Cart cleared successfully");
    };

    const getTotalItems = () => {
        return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    };

    const calculateItemSubtotal = (product, quantity) => {
        return product.selling_price * quantity;
    };

    const calculateItemDiscount = (prod_code, subtotal) => {
        const discount = itemDiscounts[prod_code];
        if (!discount || discount.type === "none") return 0;
        
        if (discount.type === "percentage") {
            return subtotal * (Number(discount.value) / 100);
        } else if (discount.type === "amount") {
            return Math.min(Number(discount.value), subtotal);
        }
        return 0;
    };

    const getItemTotals = () => {
        let vatInclusiveTotal = 0;
        let vatExemptTotal = 0;
        let totalDiscounts = 0;
        let totalVatAmount = 0;

        Object.entries(cart).forEach(([code, qty]) => {
            const product = products.find(p => p.prod_code === code);
            if (!product) return;

            const subtotal = calculateItemSubtotal(product, qty);
            const discount = calculateItemDiscount(code, subtotal);
            const afterDiscount = subtotal - discount;

            totalDiscounts += discount;

            if (product.vat_category === 'vat_exempt') {
                vatExemptTotal += afterDiscount;
            } else {
                // VAT amount = cost_price * quantity * 12%
                const vatAmount = (product.cost_price || 0) * qty * 0.12;
                totalVatAmount += vatAmount;
                vatInclusiveTotal += afterDiscount;
            }
        });

        return { vatInclusiveTotal, vatExemptTotal, totalDiscounts, totalVatAmount };
    };

    const calculateReceiptDiscount = (subtotal) => {
        if (receiptDiscountType === "percentage") {
            return subtotal * (Number(receiptDiscountValue) / 100);
        } else if (receiptDiscountType === "amount") {
            return Math.min(Number(receiptDiscountValue), subtotal);
        }
        return 0;
    };

    const getTotalAmount = () => {
        const { vatInclusiveTotal, vatExemptTotal } = getItemTotals();
        const subtotal = vatInclusiveTotal + vatExemptTotal;
        const receiptDiscount = calculateReceiptDiscount(subtotal);
        return subtotal - receiptDiscount;
    };

    const selectedProducts = () => {
        return Object.entries(cart).map(([code, qty]) => {
            const product = products.find(p => p.prod_code === code);

            if (!product) {
                return {
                    prod_code:  `missing-${code}`,
                    prod_name: "(Unknown Product)",
                    barcode: "",
                    prod_image: "",
                    selling_price: 0,
                    stock: 0,
                    quantity: qty,
                    vat_category: 'vat_inclusive'
                };
            }

            return { ... product, quantity: qty };
        });
    };

    const setItemDiscount = (prod_code, type, value) => {
        setItemDiscounts(prev => ({
            ...prev,
            [prod_code]: { type, value }
        }));
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
            .map(item => {
                const discount = itemDiscounts[item.prod_code];
                return {
                    prod_code: Number(item.prod_code),
                    quantity: Number(item.quantity),
                    item_discount_type: discount?.type || null,
                    item_discount_value: discount?.value ?  Number(discount.value) : 0
                };
            });

        if (items.length === 0) {
            Alert.alert("Error", "No valid items in cart");
            return;
        }

        try {
            const res = await fetch(`${API}/store/checkout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner_id: Number(ownerId),
                    amount_paid: Number(amountPaid),
                    discount_type: receiptDiscountType === "none" ? null : receiptDiscountType,
                    discount_value: receiptDiscountValue ?  Number(receiptDiscountValue) : 0,
                    items
                })
            });

            const textResponse = await res.text();
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
                setItemDiscounts({});
                setReceiptDiscountType("none");
                setReceiptDiscountValue("");
                setModalVisible(false);
                
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
                            <Trash2 size={16} color="#fff" style={styles.iconMargin} />
                            <Text style={styles.clearCartText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.scannerContainer}>
                    <View style={styles.scannerIcon}>
                        <Search size={20} color="#6b5d54" />
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
                            <X size={20} color="#8b8b8b" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                        style={styles.cameraButton}
                        onPress={() => setCameraScannerVisible(true)}
                    >
                        <CameraIcon size={20} color="#fff" />
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
                                    {product.vat_category === 'vat_exempt' && (
                                        <Text style={styles.vatExemptBadge}>VAT Exempt</Text>
                                    )}
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
                                <ShoppingCart size={24} color="#ffffff" />
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            <BarcodeScanner
                visible={cameraScannerVisible}
                onClose={() => setCameraScannerVisible(false)}
                onBarcodeScan={(barcode) => {
                    setCameraScannerVisible(false);
                    handleBarcodeScan(barcode);
                }}
            />

            <CheckoutModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                selectedProducts={selectedProducts()}
                removeFromCart={removeFromCart}
                handleProductClick={handleProductClick}
                itemDiscounts={itemDiscounts}
                setItemDiscount={setItemDiscount}
                receiptDiscountType={receiptDiscountType}
                setReceiptDiscountType={setReceiptDiscountType}
                receiptDiscountValue={receiptDiscountValue}
                setReceiptDiscountValue={setReceiptDiscountValue}
                getItemTotals={getItemTotals}
                getTotalAmount={getTotalAmount}
                calculateItemSubtotal={calculateItemSubtotal}
                calculateItemDiscount={calculateItemDiscount}
                calculateReceiptDiscount={calculateReceiptDiscount}
                amountPaid={amountPaid}
                setAmountPaid={setAmountPaid}
                confirmOrder={confirmOrder}
            />
        </SafeAreaView>
    );
}

// Checkout Modal Component
function CheckoutModal({
    visible,
    onClose,
    selectedProducts,
    removeFromCart,
    handleProductClick,
    itemDiscounts,
    setItemDiscount,
    receiptDiscountType,
    setReceiptDiscountType,
    receiptDiscountValue,
    setReceiptDiscountValue,
    getItemTotals,
    getTotalAmount,
    calculateItemSubtotal,
    calculateItemDiscount,
    calculateReceiptDiscount,
    amountPaid,
    setAmountPaid,
    confirmOrder
}) {
    const [showItemDiscountModal, setShowItemDiscountModal] = useState(false);
    const [currentDiscountItem, setCurrentDiscountItem] = useState(null);

    const openItemDiscount = (prod_code) => {
        setCurrentDiscountItem(prod_code);
        setShowItemDiscountModal(true);
    };

    const applyItemDiscount = (type, value) => {
        if (currentDiscountItem) {
            setItemDiscount(currentDiscountItem, type, value);
        }
        setShowItemDiscountModal(false);
        setCurrentDiscountItem(null);
    };

    const { vatInclusiveTotal, vatExemptTotal, totalDiscounts, totalVatAmount } = getItemTotals();
    const subtotal = vatInclusiveTotal + vatExemptTotal;
    const receiptDiscount = calculateReceiptDiscount(subtotal);

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                transparent={true}
                onRequestClose={onClose}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Checkout</Text>
                            <TouchableOpacity
                                style={styles.modalCloseIcon}
                                onPress={onClose}
                            >
                                <X size={20} color="#8b8b8b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                            {selectedProducts.map((item, index) => {
                                const subtotal = calculateItemSubtotal(item, item.quantity);
                                const discount = calculateItemDiscount(item.prod_code, subtotal);
                                const afterDiscount = subtotal - discount;
                                const hasDiscount = itemDiscounts[item.prod_code]?.type !== "none" && discount > 0;

                                return (
                                    <View key={`${item.prod_code}-${index}`} style={styles.modalItem}>
                                        <View style={styles.modalItemLeft}>
                                            <Text style={styles.modalItemName}>{item.prod_name}</Text>
                                            <Text style={styles.modalItemQty}>
                                                ₱{item.selling_price.toFixed(2)} × {item.quantity}
                                            </Text>
                                            {item.vat_category === 'vat_exempt' && (
                                                <Text style={styles.vatExemptTag}>VAT Exempt</Text>
                                            )}
                                            {hasDiscount && (
                                                <Text style={styles.discountTag}>
                                                    Discount: -₱{discount.toFixed(2)}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.modalItemRight}>
                                            <Text style={styles.modalItemPrice}>
                                                ₱{afterDiscount.toFixed(2)}
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
                                            <TouchableOpacity
                                                style={styles.discountButton}
                                                onPress={() => openItemDiscount(item.prod_code)}
                                            >
                                                <Percent size={12} color="#6b5d54" style={{ marginRight: 4 }} />
                                                <Text style={styles.discountButtonText}>
                                                    {hasDiscount ? 'Edit' : 'Add'} Discount
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            {/* VAT Summary */}
                                
                                {vatExemptTotal > 0 && (
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabel}>VAT Exempt</Text>
                                            <Text style={styles.summaryValue}>₱{vatExemptTotal.toFixed(2)}</Text>
                                        </View>
                                )}
                                
                                {totalVatAmount > 0 && (
                                        <View style={styles.summaryRow}>
                                            <Text style={styles.summaryLabelIndent}>VAT Inclusive</Text>
                                            <Text style={styles.summaryValueHighlight}>₱{totalVatAmount.toFixed(2)}</Text>
                                        </View>
                                )}

                            {/* Receipt Discount Section */}
                            <View style={styles.receiptDiscountSection}>
                                <Text style={styles.sectionTitle}>Receipt Discount</Text>
                                <View style={styles.discountTypeButtons}>
                                    <TouchableOpacity
                                        style={[
                                            styles.discountTypeButton,
                                            receiptDiscountType === "none" && styles.discountTypeButtonActive
                                        ]}
                                        onPress={() => {
                                            setReceiptDiscountType("none");
                                            setReceiptDiscountValue("");
                                        }}
                                    >
                                        <Text style={[
                                            styles.discountTypeText,
                                            receiptDiscountType === "none" && styles.discountTypeTextActive
                                        ]}>None</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.discountTypeButton,
                                            receiptDiscountType === "percentage" && styles.discountTypeButtonActive
                                        ]}
                                        onPress={() => setReceiptDiscountType("percentage")}
                                    >
                                        <Percent size={14} color={receiptDiscountType === "percentage" ? "#fff" : "#2d2d2d"} />
                                        <Text style={[
                                            styles.discountTypeText,
                                            receiptDiscountType === "percentage" && styles.discountTypeTextActive
                                        ]}></Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.discountTypeButton,
                                            receiptDiscountType === "amount" && styles.discountTypeButtonActive
                                        ]}
                                        onPress={() => setReceiptDiscountType("amount")}
                                    >
                                        <PhilippinePeso size={14} color={receiptDiscountType === "amount" ? "#fff" : "#2d2d2d"} />
                                        <Text style={[
                                            styles.discountTypeText,
                                            receiptDiscountType === "amount" && styles.discountTypeTextActive
                                        ]}></Text>
                                    </TouchableOpacity>
                                </View>
                                {receiptDiscountType !== "none" && (
                                    <TextInput
                                        style={styles.discountInput}
                                        keyboardType="numeric"
                                        value={receiptDiscountValue}
                                        onChangeText={setReceiptDiscountValue}
                                        placeholder={receiptDiscountType === "percentage" ? "Enter %" : "Enter amount"}
                                        placeholderTextColor="#a8a8a8"
                                    />
                                )}
                                {receiptDiscount > 0 && (
                                    <Text style={styles.discountApplied}>
                                        -₱{receiptDiscount.toFixed(2)}
                                    </Text>
                                )}
                            </View>

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

            <ItemDiscountModal
                visible={showItemDiscountModal}
                onClose={() => setShowItemDiscountModal(false)}
                onApply={applyItemDiscount}
                currentDiscount={currentDiscountItem ?  itemDiscounts[currentDiscountItem] : null}
            />
        </>
    );
}

// Item Discount Modal
function ItemDiscountModal({ visible, onClose, onApply, currentDiscount }) {
    const [type, setType] = useState(currentDiscount?.type || "none");
    const [value, setValue] = useState(currentDiscount?.value || "");

    useEffect(() => {
        if (visible) {
            setType(currentDiscount?.type || "none");
            setValue(currentDiscount?.value || "");
        }
    }, [visible, currentDiscount]);

    const handleApply = () => {
        onApply(type, value);
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.itemDiscountOverlay}>
                <View style={styles.itemDiscountContent}>
                    <View style={styles.itemDiscountHeader}>
                        <Text style={styles.itemDiscountTitle}>Item Discount</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color="#8b8b8b" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.discountTypeButtons}>
                        <TouchableOpacity
                            style={[
                                styles.discountTypeButton,
                                type === "none" && styles.discountTypeButtonActive
                            ]}
                            onPress={() => {
                                setType("none");
                                setValue("");
                            }}
                        >
                            <Text style={[
                                styles.discountTypeText,
                                type === "none" && styles.discountTypeTextActive
                            ]}>None</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.discountTypeButton,
                                type === "percentage" && styles.discountTypeButtonActive
                            ]}
                            onPress={() => setType("percentage")}
                        >
                            <Percent size={14} color={type === "percentage" ? "#fff" : "#2d2d2d"} />
                            <Text style={[
                                styles.discountTypeText,
                                type === "percentage" && styles.discountTypeTextActive
                            ]}></Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.discountTypeButton,
                                type === "amount" && styles.discountTypeButtonActive
                            ]}
                            onPress={() => setType("amount")}
                        >
                            <PhilippinePeso size={14} color={type === "amount" ? "#fff" : "#2d2d2d"} />
                            <Text style={[
                                styles.discountTypeText,
                                type === "amount" && styles.discountTypeTextActive
                            ]}></Text>
                        </TouchableOpacity>
                    </View>

                    {type !== "none" && (
                        <TextInput
                            style={styles.itemDiscountInput}
                            keyboardType="numeric"
                            value={value}
                            onChangeText={setValue}
                            placeholder={type === "percentage" ? "Enter percentage" : "Enter amount"}
                            placeholderTextColor="#a8a8a8"
                        />
                    )}

                    <View style={styles.itemDiscountButtons}>
                        <TouchableOpacity
                            style={styles.itemDiscountCancelButton}
                            onPress={onClose}
                        >
                            <Text style={styles.itemDiscountCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.itemDiscountApplyButton}
                            onPress={handleApply}
                        >
                            <Text style={styles.itemDiscountApplyText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// Barcode Scanner Component
function BarcodeScanner({ visible, onClose, onBarcodeScan }) {
    const [hasPermission, setHasPermission] = useState(null);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (visible) {
            (async () => {
                const { status } = await Camera.requestCameraPermissionsAsync();
                setHasPermission(status === 'granted');
            })();
            setScanned(false);
        }
    }, [visible]);

    const handleBarCodeScanned = ({ data }) => {
        if (! scanned) {
            setScanned(true);
            onBarcodeScan(data);
            setTimeout(() => {
                setScanned(false);
            }, 500);
        }
    };

    if (! visible) return null;

    if (hasPermission === null) {
        return (
            <Modal visible={visible} animationType="slide">
                <View style={styles.scannerModal}>
                    <Text style={styles.scannerText}>Requesting camera permission...</Text>
                </View>
            </Modal>
        );
    }

    if (hasPermission === false) {
        return (
            <Modal visible={visible} animationType="slide">
                <View style={styles.scannerModal}>
                    <Text style={styles.scannerText}>No camera access</Text>
                    <TouchableOpacity style={styles.scannerButton} onPress={onClose}>
                        <Text style={styles.scannerButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide">
            <View style={styles.scannerModal}>
                <CameraView
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["ean13", "ean8", "qr", "code128", "code39", "upc_e", "upc_a"],
                    }}
                    style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerBox} />
                    <Text style={styles.scannerInstruction}>
                        {scanned ? "✓ Scanned!" : "Position barcode in the frame"}
                    </Text>
                    <TouchableOpacity style={styles.scannerCloseButton} onPress={onClose}>
                        <Text style={styles.scannerButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
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
    headerSubtitle: {
        fontSize:  15,
        color: '#8b8b8b',
        marginTop: 4,
    },
    clearCartButton: {
        backgroundColor: '#ff4444',
        paddingHorizontal: 16,
        paddingVertical:  8,
        borderRadius:  8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    clearCartText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    iconMargin: {
        marginRight: 6,
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
    barcodeInput: {
        flex: 1,
        fontSize: 16,
        color: '#2d2d2d',
        paddingVertical: 12,
        fontWeight: '500',
    },
    clearInputButton: {
        padding: 4,
        marginRight: 8,
    },
    cameraButton: {
        backgroundColor:  '#6b5d54',
        padding: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize:  15,
        fontWeight: '700',
        color: '#6b5d54',
    },
    stockText: { 
        fontSize:  12,
        color: '#a8a8a8',
        fontWeight: '500',
    },
    vatExemptBadge: {
        fontSize: 9,
        color: '#27ae60',
        fontWeight: '700',
        marginTop: 4,
        textTransform: 'uppercase',
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
        color:  '#fff',
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
        color:  '#8b8b8b',
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
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryButtonText: {
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
    modalList: { 
        paddingHorizontal: 24,
        paddingVertical: 8,
        maxHeight: 250,
    },
    modalItem: { 
        flexDirection: 'row',
        justifyContent:  'space-between',
        alignItems: 'flex-start',
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
        fontSize:  13,
        color: '#a8a8a8',
        fontWeight: '500',
    },
    vatExemptTag: {
        fontSize: 10,
        color: '#27ae60',
        fontWeight: '700',
        marginTop: 4,
    },
    discountTag: {
        fontSize: 11,
        color: '#e74c3c',
        fontWeight: '600',
        marginTop: 4,
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
        flexDirection:  'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
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
    discountButton: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 12,
        paddingVertical:  6,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    discountButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6b5d54',
    },
    modalFooter: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
        borderTopWidth:  1,
        borderTopColor: '#f0f0f0',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#8b8b8b',
        paddingLeft: 16,
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#6b5d54',
    },
    summaryLabelIndent: {
        fontSize: 13,
        fontWeight: '500',
        color: '#8b8b8b',
        paddingLeft: 16,
    },
    summaryValueHighlight: {
        fontSize: 15,
        fontWeight: '700',
        color: '#6b5d54',
    },
    receiptDiscountSection: {
        marginTop: 12,
        marginBottom: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize:  15,
        fontWeight: '600',
        color: '#2d2d2d',
        marginBottom: 12,
    },
    discountTypeButtons: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    discountTypeButton: {
        flex: 1,
        backgroundColor: '#f5f3f0',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    discountTypeButtonActive: {
        backgroundColor: '#6b5d54',
        borderColor: '#6b5d54',
    },
    discountTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2d2d2d',
    },
    discountTypeTextActive: {
        color: '#ffffff',
    },
    discountInput: {
        borderWidth: 1,
        borderColor: '#d4c5b9',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#2d2d2d',
        backgroundColor: '#faf9f7',
    },
    discountApplied: {
        fontSize: 14,
        fontWeight: '700',
        color: '#e74c3c',
        marginTop: 8,
        textAlign: 'right',
    },
    totalRow: {
        flexDirection:  'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingTop: 12,
        borderTopWidth: 2,
        borderTopColor: '#2d2d2d',
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
    // Item Discount Modal
    itemDiscountOverlay: {
        flex: 1,
        backgroundColor:  'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    itemDiscountContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    itemDiscountHeader:  {
        flexDirection: 'row',
        justifyContent:  'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    itemDiscountTitle: {
        fontSize:  20,
        fontWeight: '700',
        color: '#2d2d2d',
    },
    itemDiscountInput: {
        borderWidth: 1,
        borderColor: '#d4c5b9',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#2d2d2d',
        backgroundColor:  '#faf9f7',
        marginBottom: 20,
    },
    itemDiscountButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    itemDiscountCancelButton: {
        flex:  1,
        backgroundColor: '#f5f3f0',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    itemDiscountCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2d2d2d',
    },
    itemDiscountApplyButton: {
        flex: 1,
        backgroundColor: '#6b5d54',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    itemDiscountApplyText: {
        fontSize:  16,
        fontWeight:  '600',
        color: '#ffffff',
    },
    // Scanner Modal Styles
    scannerModal: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems:  'center',
    },
    scannerOverlay: {
        ... StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    scannerBox: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#6b5d54',
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    scannerInstruction: {
        color: '#fff',
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    scannerCloseButton: {
        backgroundColor: '#6b5d54',
        paddingHorizontal:  40,
        paddingVertical:  14,
        borderRadius: 25,
        marginTop: 30,
    },
    scannerText: {
        color: '#fff',
        fontSize: 18,
        marginBottom: 20,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    scannerButton: {
        backgroundColor: '#6b5d54',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 25,
    },
    scannerButtonText:  {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});