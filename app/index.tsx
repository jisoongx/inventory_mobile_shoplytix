import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from "react-native";
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const response = await fetch('http://192.168.1.9:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        await AsyncStorage.setItem('owner_id', data.owner_id.toString());
        await AsyncStorage.setItem('owner_email', data.owner_email);
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

      {/* Logo + Title */}
      <View style={styles.header}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
        />
        <Text style={styles.title}>SHOPLYTIX</Text>
      </View>

      {/* Email Field */}
      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color="#b91c1c" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      {/* Password Field */}
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#b91c1c" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
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

      {/* Forgot Password */}
      <TouchableOpacity onPress={() => router.push("/forgot-password")}>
        <Text style={styles.forgotPassword}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* Login Button */}
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

  header: {
    alignSelf: 'center',    // centers the header horizontally
    alignItems: 'center',   // centers logo above text
    marginBottom: 24,
  },

  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    position: 'relative',
    top: 10,     // move down (+) or up (-)
    left: -6,    // move right (+) or left (-)
    marginBottom: 8,
  },


  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#b91c1c",
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
  },

  icon: {
    marginRight: 8,
  },

  input: {
    flex: 1,
    height: 40,
  },

  forgotPassword: {
    color: "#b91c1c",
    textAlign: "right",
    marginBottom: 16,
    textDecorationLine: "underline",
    fontSize: 14,
  },

  button: {
    backgroundColor: "#b91c1c",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 16,
  },
});
