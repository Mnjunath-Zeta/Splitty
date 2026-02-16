import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSplittyStore } from '../store/useSplittyStore';
import { Themes, ThemeName, Colors } from '../constants/Colors';
import { GlassCard } from '../components/GlassCard';
import { StyledInput } from '../components/StyledInput';
import { VibrantButton } from '../components/VibrantButton';
import { ArrowLeft, User, Mail, Phone } from 'lucide-react-native';

export default function ProfileEditScreen() {
    const router = useRouter();
    const { userProfile, updateUserProfile, appearance, colors } = useSplittyStore();
    const isDark = appearance === 'dark';

    const [name, setName] = useState(userProfile.name);
    const [email, setEmail] = useState(userProfile.email);
    const [phone, setPhone] = useState(userProfile.phone || '');
    const [avatar, setAvatar] = useState(userProfile.avatar || null);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const handleSave = () => {
        if (!name.trim() || !email.trim()) {
            Alert.alert('Error', 'Name and Email are required.');
            return;
        }

        updateUserProfile({ name, email, phone, avatar: avatar || undefined });
        router.back();
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
                        <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(129, 140, 248, 0.2)' : 'rgba(99, 102, 241, 0.1)', overflow: 'hidden' }]}>
                            {avatar ? (
                                <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <User size={64} color={colors.primary} />
                            )}
                        </View>
                        <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
                    </TouchableOpacity>
                </View>

                <GlassCard style={[styles.formCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.inputGroup}>
                        <View style={styles.iconContainer}>
                            <User size={20} color={colors.textSecondary} />
                        </View>
                        <StyledInput
                            label="Full Name"
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter your name"
                            containerStyle={{ flex: 1, marginBottom: 0 }}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <View style={styles.iconContainer}>
                            <Mail size={20} color={colors.textSecondary} />
                        </View>
                        <StyledInput
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter your email"
                            keyboardType="email-address"
                            containerStyle={{ flex: 1, marginBottom: 0 }}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <View style={styles.iconContainer}>
                            <Phone size={20} color={colors.textSecondary} />
                        </View>
                        <StyledInput
                            label="Phone Number"
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Enter phone number"
                            keyboardType="phone-pad"
                            containerStyle={{ flex: 1, marginBottom: 0 }}
                        />
                    </View>
                </GlassCard>

                <VibrantButton
                    title="Save Changes"
                    onPress={handleSave}
                    style={styles.saveButton}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    container: {
        padding: 20,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    changePhotoText: {
        fontSize: 14,
        fontWeight: '600',
    },
    formCard: {
        padding: 20,
        marginBottom: 24,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        gap: 12,
    },
    iconContainer: {
        marginTop: 32, // Align roughly with input text
    },
    saveButton: {
        marginTop: 20,
    },
});
