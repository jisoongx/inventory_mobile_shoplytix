import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

interface BarcodeScannerProps {
    visible: boolean;
    onClose: () => void;
    onBarcodeScan: (barcode: string) => void;
}

export default function BarcodeScanner({ visible, onClose, onBarcodeScan }: BarcodeScannerProps) {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        const getBarCodeScannerPermissions = async () => {
            const { status } = await BarCodeScanner.requestPermissionsAsync();
            setHasPermission(status === 'granted');
        };

        if (visible) {
            getBarCodeScannerPermissions();
            setScanned(false);
        }
    }, [visible]);

    const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
        if (! scanned) {
            setScanned(true);
            onBarcodeScan(data);
            setTimeout(() => {
                setScanned(false);
                onClose();
            }, 500);
        }
    };

    if (hasPermission === null) {
        return (
            <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
                <View style={styles.container}>
                    <Text style={styles.messageText}>Requesting camera permission...</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    if (hasPermission === false) {
        return (
            <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
                <View style={styles.container}>
                    <Text style={styles.messageText}>No access to camera</Text>
                    <Text style={styles.subMessageText}>Please enable camera permissions in settings</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <BarCodeScanner
                    onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                    style={StyleSheet.absoluteFillObject}
                    barCodeTypes={[
                        BarCodeScanner.Constants.BarCodeType.ean13,
                        BarCodeScanner.Constants.BarCodeType.ean8,
                        BarCodeScanner.Constants.BarCodeType.qr,
                        BarCodeScanner.Constants.BarCodeType.code128,
                        BarCodeScanner.Constants.BarCodeType.code39,
                        BarCodeScanner.Constants.BarCodeType.upc_e,
                        BarCodeScanner.Constants.BarCodeType.upc_a,
                    ]}
                />
                <View style={styles.overlay}>
                    <View style={styles.topOverlay} />
                    <View style={styles.middleRow}>
                        <View style={styles.sideOverlay} />
                        <View style={styles.scanArea}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>
                        <View style={styles.sideOverlay} />
                    </View>
                    <View style={styles.bottomOverlay}>
                        <Text style={styles.instructionText}>
                            Position barcode within the frame
                        </Text>
                        {scanned && (
                            <Text style={styles.scannedText}>✓ Scanned! </Text>
                        )}
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex:  1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems:  'center',
    },
    overlay: {
        ... StyleSheet.absoluteFillObject,
    },
    topOverlay: {
        flex: 1,
        backgroundColor:  'rgba(0,0,0,0.6)',
    },
    middleRow: {
        flexDirection:  'row',
        height: 250,
    },
    sideOverlay:  {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    scanArea: {
        width: 250,
        height: 250,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#6b5d54',
        borderWidth: 4,
    },
    topLeft: {
        top: 0,
        left:  0,
        borderBottomWidth: 0,
        borderRightWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
    },
    bottomLeft:  {
        bottom: 0,
        left: 0,
        borderTopWidth: 0,
        borderRightWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderTopWidth: 0,
        borderLeftWidth: 0,
    },
    bottomOverlay: {
        flex:  1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    instructionText: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 10,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    scannedText: {
        color:  '#27ae60',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 15,
    },
    messageText: {
        color: '#fff',
        fontSize: 18,
        marginBottom: 10,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    subMessageText: {
        color: '#a8a8a8',
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    closeButton: {
        backgroundColor: '#6b5d54',
        paddingHorizontal: 40,
        paddingVertical:  14,
        borderRadius: 25,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});