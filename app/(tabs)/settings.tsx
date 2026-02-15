import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, SafeAreaView, Image } from 'react-native';
import { LightColors, DarkColors } from '../../constants/Colors';
import { GlassCard } from '../../components/GlassCard';
import { useSplittyStore } from '../../store/useSplittyStore';
import { User, Bell, Moon, Trash2, LogOut, Info, ChevronRight, CreditCard, DollarSign } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
    const { clearData, isDarkMode, toggleTheme, currency, setCurrency, userProfile, signOut } = useSplittyStore();
    const [notifications, setNotifications] = useState(true);
    const router = useRouter();

    const colors = isDarkMode ? DarkColors : LightColors;

    const handleCurrencyChange = () => {
        Alert.alert(
            "Select Currency",
            "Choose your preferred currency symbol",
            [
                { text: "USD ($)", onPress: () => setCurrency('USD') },
                { text: "EUR (€)", onPress: () => setCurrency('EUR') },
                { text: "GBP (£)", onPress: () => setCurrency('GBP') },
                { text: "INR (₹)", onPress: () => setCurrency('INR') },
                { text: "JPY (¥)", onPress: () => setCurrency('JPY') },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const handleClearData = () => {
        Alert.alert(
            "Clear All Data",
            "This will delete all friends, groups, and expenses. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Everything",
                    style: "destructive",
                    onPress: () => {
                        clearData();
                        Alert.alert("Success", "All data has been reset.");
                    }
                }
            ]
        );
    };

    const handleSettleUp = () => {
        Alert.alert("Coming Soon", "Settle Up feature will allow you to record payments and clear debts effectively.");
    };

    const renderSettingItem = (icon: React.ReactNode, label: string, rightElement: React.ReactNode, onPress?: () => void) => (
        <TouchableOpacity
            style={styles.settingItem}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={styles.settingLeft}>
                {icon}
                <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
            </View>
            {rightElement}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Profile</Text>
                    <GlassCard style={[styles.profileCard, { backgroundColor: colors.surface }]}>
                        <View style={[styles.avatar, { backgroundColor: isDarkMode ? 'rgba(129, 140, 248, 0.2)' : 'rgba(99, 102, 241, 0.1)', overflow: 'hidden' }]}>
                            {userProfile.avatar ? (
                                <Image source={{ uri: userProfile.avatar }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <User size={32} color={colors.primary} />
                            )}
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: colors.text }]}>{userProfile.name}</Text>
                            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{userProfile.email}</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.editButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            onPress={() => router.push('/profile-edit')}
                        >
                            <Text style={[styles.editButtonText, { color: colors.text }]}>Edit</Text>
                        </TouchableOpacity>
                    </GlassCard>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>General</Text>
                    <GlassCard style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
                        {renderSettingItem(
                            <Moon size={20} color={colors.textSecondary} />,
                            "Dark Mode",
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={'white'}
                            />
                        )}
                        <View style={[styles.separator, { backgroundColor: colors.border }]} />
                        {renderSettingItem(
                            <DollarSign size={20} color={colors.textSecondary} />,
                            "Currency",
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{currency}</Text>
                                <ChevronRight size={20} color={colors.textSecondary} />
                            </View>,
                            handleCurrencyChange
                        )}
                        <View style={[styles.separator, { backgroundColor: colors.border }]} />
                        {renderSettingItem(
                            <Bell size={20} color={colors.textSecondary} />,
                            "Notifications",
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={'white'}
                            />
                        )}
                    </GlassCard>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Actions</Text>
                    <GlassCard style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
                        {renderSettingItem(
                            <CreditCard size={20} color={colors.textSecondary} />,
                            "Settle Up",
                            <ChevronRight size={20} color={colors.textSecondary} />,
                            handleSettleUp
                        )}
                    </GlassCard>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
                    <GlassCard style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
                        {renderSettingItem(
                            <LogOut size={20} color={colors.error} />,
                            "Sign Out",
                            <ChevronRight size={20} color={colors.textSecondary} />,
                            signOut
                        )}
                    </GlassCard>
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.versionText, { color: colors.textSecondary }]}>Splitty v1.0.0</Text>
                    <Text style={[styles.copyrightText, { color: colors.textSecondary }]}>Made with ❤️ by AntiGravity</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        padding: 20,
        paddingBottom: 40,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '700',
    },
    profileEmail: {
        fontSize: 14,
    },
    editButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    editButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    settingsCard: {
        padding: 0,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingLabel: {
        fontSize: 16,
    },
    separator: {
        height: 1,
        marginLeft: 48,
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
    },
    versionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    copyrightText: {
        fontSize: 12,
        marginTop: 4,
    },
});
