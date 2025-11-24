import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { email } = useLocalSearchParams(); // IMPORTANT ✔

    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        if (!email) {
            Alert.alert(
                "Error",
                "No email provided. Please start the reset process again.",
                [{ text: "OK", onPress: () => router.push("/forgot-password") }]
            );
        }
    }, [email]);

    const handleResetPassword = async () => {
        if (!email) return;

        if (!code || !password || !confirmPassword) {
            return Alert.alert("Error", "Please fill out all fields.");
        }

        const passwordPattern =
            /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\W_]).{8,}$/;

        if (!passwordPattern.test(password)) {
            return Alert.alert(
                "Error",
                "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
            );
        }

        if (password !== confirmPassword) {
            return Alert.alert("Error", "Passwords do not match.");
        }

        try {
            const res = await fetch("http://192.168.1.9:8000/api/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    token: code,
                    password,
                    password_confirmation: confirmPassword,
                }),
            });

            const text = await res.text();
            let data;

            try {
                data = JSON.parse(text);
            } catch {
                return Alert.alert("Error", "Server returned invalid response.");
            }

            if (data.success) {
                Alert.alert("Success", data.message, [
                    { text: "OK", onPress: () => router.push("/") },
                ]);
            } else {
                Alert.alert("Error", data.message);
            }
        } catch (err) {
            Alert.alert("Error", "Unable to connect to server.");
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Reset Password</Text>

                

                <Text style={styles.label}>Reset Code <Text style={styles.asterisk}>*</Text></Text>
                <TextInput
                  
                    value={code}
                    onChangeText={setCode}
                    style={styles.input}
                />

                <Text style={styles.label}>New Password <Text style={styles.asterisk}>*</Text></Text>
                <View style={styles.inputContainer}>
                    <TextInput
                       
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        style={styles.inputFlex}
                    />
                    {password.length > 0 && (
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons
                                name={showPassword ? "eye-outline" : "eye-off-outline"}
                                size={20}
                                color="#b91c1c"
                            />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.label}>Confirm Password <Text style={styles.asterisk}>*</Text></Text>
                <View style={styles.inputContainer}>
                    <TextInput
                       
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        style={styles.inputFlex}
                    />
                    {confirmPassword.length > 0 && (
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                            <Ionicons
                                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                                size={20}
                                color="#b91c1c"
                            />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
                    <Text style={styles.buttonText}> Confirm</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#f9fafb" },
    title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center", },
    emailText: { fontSize: 14, textAlign: "center", color: "gray", marginBottom: 16 },
    label: { fontWeight: "bold", marginBottom: 4 },
    asterisk: { color: "red" },
    input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginBottom: 16, backgroundColor: "#fff" },
    inputContainer: { flexDirection: "row", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, backgroundColor: "#fff", alignItems: "center" },
    inputFlex: { flex: 1, paddingVertical: 12 },
    button: { backgroundColor: "#b91c1c", padding: 12, borderRadius: 8 },
    buttonText: { color: "#fff", fontWeight: "bold", textAlign: "center" },
});
