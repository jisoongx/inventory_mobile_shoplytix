import React, { useState } from "react";
import { useRouter } from "expo-router";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from "react-native";

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleForgotPassword = async () => {
        if (!email) {
            return Alert.alert("Error", "Please enter your email.");
        }

        setLoading(true);

        try {
            const res = await fetch("http://192.168.1.9:8000/api/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const text = await res.text();
            let data;

            try {
                data = JSON.parse(text);
            } catch {
                Alert.alert("Error", "Invalid server response.");
                setLoading(false);
                return;
            }

            if (data.success) {
                Alert.alert("Success", data.message, [
                    {
                        text: "OK",
                        onPress: () =>
                            router.push({
                                pathname: "/reset-password",
                                params: { email },
                            }),
                    },
                ]);
            } else {
                Alert.alert("Error", data.message);
            }
        } catch (err) {
            Alert.alert("Error", "Unable to connect to server.");
        }

        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Forgot Password</Text>

            <TextInput
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            <TouchableOpacity
                style={[styles.button, loading && { opacity: 0.6 }]}
                onPress={handleForgotPassword}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? "Sending..." : "Send Code"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f9fafb" },
    title: { fontSize: 22, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
    input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginBottom: 16 },
    button: { backgroundColor: "#b91c1c", padding: 12, borderRadius: 8 },
    buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
});
