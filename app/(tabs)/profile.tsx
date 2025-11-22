// app/(tabs)/profile.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

export default function ProfileScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const [owner, setOwner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollingInterval = useRef<NodeJS.Timer | null>(null);

  const fetchOwnerDetails = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      let email = params.email as string;
      if (!email) {
        email = await AsyncStorage.getItem('owner_email') || '';
      }

      if (!email) {
        if (!silent) Alert.alert("Error", "No email found. Please login again.");
        return;
      }

      const response = await fetch(
        `http://192.168.1.8:8000/api/owner?email=${encodeURIComponent(email)}`
      );


      const data = await response.json();

      if (response.ok && data.success) {
        setOwner(data.owner);
      } else {
        if (!silent) Alert.alert("Error", data.message || "Failed to fetch profile.");
      }

    } catch (error: any) {
      console.error("Fetch owner error:", error);
      if (!silent) Alert.alert("Error", "Unable to connect to server.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchOwnerDetails();
  }, []);

  // Polling on focus like notifications
  useFocusEffect(
    useCallback(() => {
      pollingInterval.current = setInterval(() => {
        fetchOwnerDetails(true);
      }, 5000); // every 5 seconds

      return () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#960204" />
        <Text style={{ marginTop: 10 }}>Loading profile...</Text>
      </View>
    );
  }

  if (!owner) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No profile data found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={{ color: "#fff", fontWeight: "bold" }}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Owner Profile</Text>

        <View style={styles.profileBox}>
          <Text style={styles.label}>Full Name</Text>
          <Text style={styles.value}>{owner.firstname} {owner.middlename} {owner.lastname}</Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{owner.email}</Text>

          <Text style={styles.label}>Contact</Text>
          <Text style={styles.value}>{owner.contact}</Text>

          <Text style={styles.label}>Store Name</Text>
          <Text style={styles.value}>{owner.store_name}</Text>

          <Text style={styles.label}>Store Address</Text>
          <Text style={styles.value}>{owner.store_address}</Text>


        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  backBtn: {
    backgroundColor: "#960204",
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
    borderBottomRightRadius: 10,
    margin: 12,
  },
  content: { padding: 20 },
  header: { fontSize: 26, fontWeight: "bold", marginBottom: 15 },
  profileBox: { backgroundColor: "#fff", padding: 20, borderRadius: 10, elevation: 3 },
  label: { fontSize: 16, marginTop: 12, fontWeight: "bold", color: "#555" },
  value: { fontSize: 16, marginTop: 2 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});
