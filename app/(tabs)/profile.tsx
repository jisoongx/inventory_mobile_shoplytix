import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { API } from "../constants";

export default function ProfileScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const [owner, setOwner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedOwner, setEditedOwner] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Password modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const pollingInterval = useRef<any>(null);

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
        `${API}/owner?email=${encodeURIComponent(email)}`
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setOwner(data.owner);
        setEditedOwner(data.owner);
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

  const handleSaveProfile = async () => {
    try {
      setSaving(true);

      const response = await fetch(
        `${API}/owner/update`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: owner.email, // email as identifier, not editable
            firstname: editedOwner.firstname,
            middlename: editedOwner.middlename,
            lastname: editedOwner.lastname,
            contact: editedOwner.contact,
            store_name: editedOwner.store_name,
            store_address: editedOwner.store_address,
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setOwner(editedOwner);
        setEditMode(false);
        Alert.alert("Success", "Profile updated successfully!");
      } else {
        Alert.alert("Error", data.message || "Failed to update profile.");
      }

    } catch (error: any) {
      console.error("Update error:", error);
      Alert.alert("Error", "Unable to connect to server.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedOwner(owner);
    setEditMode(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("owner_email");
            router.replace("/"); // adjust route if needed
          }
        }
      ]
    );
  };


  const handleChangePassword = async () => {
    // Validate the form fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields.");
      return;
    }

    // Check if the new passwords match
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords don't match.");
      return;
    }

    // Validate the new password length and criteria
    const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\W_]).{8,}$/;
    if (!passwordPattern.test(newPassword)) {
      Alert.alert(
        "Error",
        "Password must be at least 8 characters, including an uppercase letter, lowercase letter, number, and special character."
      );
      return;
    }

    try {
      setChangingPassword(true); // Show loading indicator

      // Step 1: Verify the current password by sending it to the server
      const verifyResponse = await fetch(
        `${API}/owner/verify-current-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: owner.email,
            current_password: currentPassword, // Send current password for verification
          }),
        }
      );

      const verifyData = await verifyResponse.json();

      // Step 2: Check if the server responded with an error
      if (!verifyResponse.ok || !verifyData.success) {
        // If current password is incorrect, show error
        Alert.alert("Error", verifyData.message || "Current password is incorrect.");
        return;
      }

      // Step 3: Proceed with changing the password if the current password is correct
      const changePasswordResponse = await fetch(
        `${API}/owner/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: owner.email,
            current_password: currentPassword,
            new_password: newPassword,
            new_password_confirmation: confirmPassword, //  <-- REQUIRED
          }),
        }
      );


      const changePasswordData = await changePasswordResponse.json();

      // Step 4: Show success or failure message
      if (changePasswordResponse.ok && changePasswordData.success) {
        Alert.alert("Success", "Password changed successfully!");
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert("Error", changePasswordData.message || "Failed to change password.");
      }
    } catch (error) {
      console.error("Change password error:", error);
      Alert.alert("Error", "Unable to connect to the server.");
    } finally {
      setChangingPassword(false); // Hide loading indicator
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchOwnerDetails();
  }, []);

  // Polling on focus
  useFocusEffect(
    useCallback(() => {
      if (!editMode) {
        pollingInterval.current = setInterval(() => {
          fetchOwnerDetails(true);
        }, 5000);
      }

      return () => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
      };
    }, [editMode])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#960204" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!owner) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-circle-outline" size={80} color="#ccc" />
        <Text style={styles.noDataText}>No profile data found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back button and action buttons */}
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#960204" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {!editMode && (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(true)}>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={50} color="#960204" />
          </View>
          <Text style={styles.profileName}>
            {owner.firstname} {owner.lastname}
          </Text>
          <Text style={styles.profileEmail}>{owner.email}</Text>
        </View>

        {/* Info Cards */}
        {!editMode && (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Contact Number</Text>
              <Text style={styles.value}>{owner.contact}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Store Name</Text>
              <Text style={styles.value}>{owner.store_name}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Store Address</Text>
              <Text style={styles.value}>{owner.store_address}</Text>
            </View>
          </>
        )}

        {/* Edit Mode Fields */}
        {editMode && (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={editedOwner?.firstname}
                onChangeText={(text) => setEditedOwner({ ...editedOwner, firstname: text })}
                placeholder="First Name"
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.label}>Middle Name</Text>
              <TextInput
                style={styles.input}
                value={editedOwner?.middlename}
                onChangeText={(text) => setEditedOwner({ ...editedOwner, middlename: text })}
                placeholder="Middle Name"
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={editedOwner?.lastname}
                onChangeText={(text) => setEditedOwner({ ...editedOwner, lastname: text })}
                placeholder="Last Name"
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.label}>Contact Number</Text>
              <TextInput
                style={styles.input}
                value={editedOwner?.contact}
                onChangeText={(text) => setEditedOwner({ ...editedOwner, contact: text })}
                placeholder="Contact Number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.label}>Store Name</Text>
              <TextInput
                style={styles.input}
                value={editedOwner?.store_name}
                onChangeText={(text) => setEditedOwner({ ...editedOwner, store_name: text })}
                placeholder="Store Name"
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.label}>Store Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editedOwner?.store_address}
                onChangeText={(text) => setEditedOwner({ ...editedOwner, store_address: text })}
                placeholder="Store Address"
                multiline
                numberOfLines={3}
              />
            </View>
          </>
        )}

        {/* Save and Cancel Buttons */}
        {editMode && (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={handleCancelEdit}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.saveBtn]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Change Password Button */}
        {!editMode && (
          <TouchableOpacity style={styles.changePasswordBtn} onPress={() => setShowPasswordModal(true)}>
            <Ionicons name="lock-closed-outline" size={20} color="#960204" />
            <Text style={styles.changePasswordText}>Change Password</Text>
          </TouchableOpacity>
        )}
        {!editMode && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color="#960204" />

            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Password Change Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Current Password */}
              <Text style={styles.inputLabel}>Current Password</Text>
              <View style={styles.passwordFieldContainer}>
                <TextInput
                  style={styles.modalInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                />
                {currentPassword && (
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Ionicons
                      name={showCurrentPassword ? "eye" : "eye-off"}
                      size={20}
                      color="#333"
                      style={styles.eyeIcon}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* New Password */}
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.passwordFieldContainer}>
                <TextInput
                  style={styles.modalInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                />
                {newPassword && (
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons
                      name={showNewPassword ? "eye" : "eye-off"}
                      size={20}
                      color="#333"
                      style={styles.eyeIcon}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Confirm New Password */}
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.passwordFieldContainer}>
                <TextInput
                  style={styles.modalInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                {confirmPassword && (
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? "eye" : "eye-off"}
                      size={20}
                      color="#333"
                      style={styles.eyeIcon}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Save Button for Password Change */}
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Change Password</Text>
                )}
              </TouchableOpacity>
              
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backText: {
    marginLeft: 5,
    fontSize: 14,
    color: "#960204",
    fontWeight: "600",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#960204",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
  },
  editBtnText: {
    marginLeft: 5,
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 10,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 15,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 14,
    color: "#666",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  input: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
    borderBottomWidth: 1,
    borderBottomColor: "#960204",
    paddingVertical: 5,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  changePasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#960204",
    elevation: 1,
  },
  changePasswordText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#960204",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#666",
  },
  noDataText: {
    marginTop: 15,
    fontSize: 16,
    color: "#999",
  },

  // Modal overlay style
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  // Modal content wrapper
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    elevation: 5,
  },

  // Modal header with title and close button
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },

  // Body of the modal for password input fields
  modalBody: {
    padding: 20,
  },

  // Label for each input field
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    marginTop: 12,
  },

  // Input field style for modal
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,  // Adds padding inside the input
    paddingVertical: 12,    // Adds padding inside the input
    fontSize: 16,
    backgroundColor: "#f9f9f9",
    width: '100%', // Ensures the input fills the available width
    paddingRight: 40, // Space for the eye icon inside the input
  },

  // Save button style for the modal
  modalSaveBtn: {
    backgroundColor: "#960204",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    elevation: 2,
  },

  modalSaveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Container for each password field with eye icon
  passwordFieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    width: '100%', // Ensures it takes the full width of the container
  },

  // Eye icon positioning
  eyeIcon: {
    position: "absolute",
    right: 10, // Adjusts the icon to be on the right side of the input
    top: '50%', // Vertically centers the icon inside the field
    transform: [{ translateY: -35 }], // Adjusts for perfect vertical centering
  },

  // Action buttons inside the profile screen
  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },

  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    elevation: 2,
  },

  cancelBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  saveBtn: {
    backgroundColor: "#960204",
  },

  cancelBtnText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 16,
  },

  saveBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#960204",
    elevation: 1,
  },
  logoutText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#960204",
    fontWeight: "600",
  },

});
