import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

const handleLogin = async () => {
  try {
    const response = await fetch('http://192.168.100.20:8000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      
      await AsyncStorage.setItem('owner_id', data.owner_id.toString());
      await AsyncStorage.setItem('owner_email', data.owner_email);
      await AsyncStorage.setItem('owner_name', data.owner_name);
      Alert.alert('Success', data.owner_email);
      router.replace("/(tabs)/dashboard");
    } else {
      Alert.alert('Error', data.message);
    }
  } catch (error) {
    console.error(error);
    Alert.alert('Error', 'Unable to connect to the server.');
  }
};
    

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Owner Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#f9fafb",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#b91c1c",
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 16,
  },
});
