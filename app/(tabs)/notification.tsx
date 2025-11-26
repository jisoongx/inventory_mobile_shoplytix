// app/(tabs)/notification.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { API } from "../constants";

export default function NotificationScreen() {
  type Notification = {
    notif_id: number;
    notif_type: string;
    notif_title: string;
    notif_message: string;
    notif_created_on: Date;
    usernotif_is_read: number;
  };


  const params = useLocalSearchParams();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  
  
  const pollingInterval = useRef<any>(null);

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      pollingInterval.current = setInterval(() => {
        fetchNotifications(true); 
      }, 1000); 

      return () => {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
      };
    }, [filter])
  );

  const fetchNotifications = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      
      let email: string | null = (params.email as string) ?? null;

      if (!email) {
        email = await AsyncStorage.getItem('owner_email');
      }

      if (!email) {
        if (!silent) {
          Alert.alert('Error', 'User email not found');
        }
        return;
      }

      const response = await fetch(
        `${API}/notifications?email=${email}&filter=${filter}`
      );

      const data = await response.json();
      
      if (response.ok && data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      } else {
        if (!silent) {
          Alert.alert('Error', data.message || 'Failed to fetch notifications');
        }
      }
    } catch (error) {
      console.error('Notification fetch error:', error);
      if (!silent) {
        Alert.alert('Error', 'Unable to connect to the server');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  const markAsRead = async (notification: any) => {
    try {
      let email: string | null = (params.email as string) ?? null;

      if (!email) {
        email = await AsyncStorage.getItem('owner_email');
      }

      const response = await fetch(
        `${API}/notifications/${notification.notif_id}/read`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email })
        }
      );

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => 
            n.notif_id === notification.notif_id 
              ? { ...n, usernotif_is_read: 1 } 
              : n
          )
        );
        
        if (!notification.usernotif_is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }

        setSelectedNotification({ ...notification, usernotif_is_read: 1 });
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedNotification(null);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'sale': return 'cash-outline';
      case 'alert': return 'warning-outline';
      case 'info': return 'information-circle-outline';
      default: return 'notifications-outline';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'sale': return '#4CAF50';
      case 'alert': return '#FF9800';
      case 'info': return '#2196F3';
      default: return '#960204';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#960204" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {/* Filter Tabs */}
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        paddingHorizontal: 12,
        paddingTop: 8,
      }}>
        <TouchableOpacity
          onPress={() => setFilter('all')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderBottomWidth: 3,
            borderBottomColor: filter === 'all' ? '#960204' : 'transparent',
            alignItems: 'center',
          }}
        >
          <Text style={{
            fontSize: 15,
            fontWeight: filter === 'all' ? 'bold' : '600',
            color: filter === 'all' ? '#960204' : '#666',
          }}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('unread')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderBottomWidth: 3,
            borderBottomColor: filter === 'unread' ? '#960204' : 'transparent',
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Text style={{
            fontSize: 15,
            fontWeight: filter === 'unread' ? 'bold' : '600',
            color: filter === 'unread' ? '#960204' : '#666',
          }}>
            Unread
          </Text>
          {unreadCount > 0 && (
            <View style={{
              backgroundColor: '#960204',
              borderRadius: 10,
              minWidth: 20,
              height: 20,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 6,
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notif_id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#960204']}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => markAsRead(item)}
            activeOpacity={0.7}
          >
            <View style={{
              backgroundColor: item.usernotif_is_read ? '#fff' : '#fff5f5',
              padding: 16,
              marginHorizontal: 12,
              marginVertical: 6,
              borderRadius: 8,
              borderLeftWidth: 4,
              borderLeftColor: item.usernotif_is_read ? '#e0e0e0' : '#960204',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#960204',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons 
                    name={getNotificationIcon(item.notif_type)} 
                    size={20} 
                    color="#fff" 
                  />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontWeight: item.usernotif_is_read ? 'normal' : 'bold',
                    fontSize: 15,
                    color: '#333',
                    marginBottom: 4 
                  }}>
                    {item.notif_title}
                  </Text>
                  <Text 
                    style={{ 
                      color: '#666', 
                      fontSize: 13,
                      lineHeight: 18,
                      marginBottom: 6
                    }}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.notif_message}
                  </Text>
                  <Text style={{ color: '#999', fontSize: 11 }}>
                    {new Date(item.notif_created_on).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>

                {!item.usernotif_is_read && (
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#960204',
                    marginTop: 6,
                  }} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: 60, alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={80} color="#ccc" />
            <Text style={{ color: '#999', marginTop: 16, fontSize: 16 }}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 12 }}
      />

      {/* Notification Detail Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            width: '90%',
            maxHeight: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}>
            {selectedNotification && (
              <>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: '#e0e0e0',
                  gap: 12,
                }}>
                  <View style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: getNotificationColor(selectedNotification.notif_type),
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons 
                      name={getNotificationIcon(selectedNotification.notif_type)} 
                      size={24} 
                      color="#fff" 
                    />
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: '#333',
                      marginBottom: 4,
                    }}>
                      {selectedNotification.notif_title}
                    </Text>
                    <Text style={{ color: '#999', fontSize: 12 }}>
                      {new Date(selectedNotification.notif_created_on).toLocaleString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>

                  <TouchableOpacity 
                    onPress={closeModal}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={28} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{
                  padding: 20,
                  maxHeight: 400,
                }}>
                  <Text style={{
                    fontSize: 15,
                    color: '#333',
                    lineHeight: 24,
                  }}>
                    {selectedNotification.notif_message}
                  </Text>
                </ScrollView>

                <View style={{
                  padding: 16,
                  borderTopWidth: 1,
                  borderTopColor: '#e0e0e0',
                }}>
                  <TouchableOpacity
                    onPress={closeModal}
                    style={{
                      backgroundColor: '#960204',
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '600',
                    }}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}