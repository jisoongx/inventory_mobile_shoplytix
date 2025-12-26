// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { API } from "../constants";

export default function TabsLayout() {
  const router = useRouter();
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const pollingInterval = useRef<any>(null);

  useEffect(() => {
    loadUserData();
    
    pollingInterval.current = setInterval(() => {
      fetchUnreadCount();
    }, 1000); 

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  const loadUserData = async () => {
    try {
      const email = await AsyncStorage.getItem('owner_email');
      setOwnerEmail(email);
      if (email) {
        fetchUnreadCount(email);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const fetchUnreadCount = async (email?: string) => {
    try {
      const userEmail = email || ownerEmail;
      if (!userEmail) return;

      const response = await fetch(
        `${API}/notifications?email=${userEmail}&filter=all`
      );

      const data = await response.json();
      
      console.log("fetchUnreadCount response:", data);

      if (response.ok && data.success) {
        setUnseenCount(Number(data.unseen_count) || 0);
      }
    } catch (error) {
      console.error('Error fetching unseen count:', error);
    }
  };

  const handleNotificationPress = async () => {
    if (!ownerEmail) {
      Alert.alert('Error', 'Email not found. Please login again.');
      return;
    }

    try {
      
      await fetch(`${API}/notifications/bell-clicked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail }),
      });

      // 2️⃣ Navigate to the notifications page
      router.push({
        pathname: "/(tabs)/notification",
        params: { email: ownerEmail }
      });

      // 3️⃣ Optional: update the unseenCount locally to 0
      setUnseenCount(0);

    } catch (error) {
      console.error('Failed to mark notifications as seen:', error);
    }
  };


  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true, 
        headerStyle: {
          backgroundColor: "#960204",
          height: 100,
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 20,
        },
        headerRight: () => (
          <View style={{ flexDirection: "row", marginRight: 16, gap: 12 }}>
            <TouchableOpacity 
              onPress={handleNotificationPress}
              style={{ position: "relative" }}
            >
              <Ionicons name="notifications-outline" size={26} color="#ffffff" />
              {unseenCount > 0 && (
                <View style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: '#ff4444',
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 4,
                    zIndex: 999,
                  }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                      {unseenCount > 99 ? '99+' : unseenCount}
                    </Text>
                  </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (!ownerEmail) {
                  Alert.alert("Error", "Unable to load profile. Please login again.");
                  return;
                }

                router.push({
                  pathname: "/(tabs)/profile",
                  params: { email: ownerEmail }
                });
              }}
            >
              <Ionicons name="person-circle-outline" size={28} color="#ffffff" />
            </TouchableOpacity>

          </View>
        ),
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "#ffcccc",
        tabBarStyle: {
          backgroundColor: "#960204",
          borderTopWidth: 0,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";
          if (route.name === "dashboard") iconName = focused ? "home" : "home-outline";
          else if (route.name === "store") iconName = focused ? "storefront" : "storefront-outline";
          else if (route.name === "inventory") iconName = focused ? "file-tray" : "file-tray-outline";
          return <Ionicons name={iconName} size={26} color={color} />;
        },
      })}
    >
      <Tabs.Screen 
        name="dashboard" 
        options={{ 
          title: "Dashboard",
          tabBarLabel: "Dashboard"
        }} 
      />
      <Tabs.Screen 
        name="store" 
        options={{ 
          title: "Store",
          tabBarLabel: "Store"
        }} 
      />
      <Tabs.Screen 
        name="inventory" 
        options={{ 
          title: "Inventory",
          tabBarLabel: "Inventory"
        }} 
      />
      <Tabs.Screen 
        name="notification" 
        options={{ 
          title: "Notification",
          tabBarLabel: "Notification",
          href: null,
        }} 
      />
      <Tabs.Screen 
        name="categorysaletable" 
        options={{ 
          title: "Category Sales",
          tabBarLabel: "Category Sales",
          href: null,
        }} 
      />
      <Tabs.Screen 
        name="productsaletable" 
        options={{ 
          title: "Product Sales",
          tabBarLabel: "Product Sales",
          href: null,
        }} 
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: null,
        }}
      />

    </Tabs>
    
  );
}