
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, SafeAreaView, Image, Modal } from 'react-native';
import { AccentPalettes, AccentName, AppearanceMode } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { GlassCard } from '../../components/GlassCard';
import { useSplittyStore } from '../../store/useSplittyStore';
import { User, Bell, Trash2, LogOut, ChevronRight, CreditCard, DollarSign, Activity, Palette, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
    const {
        clearData,
        appearance,
        setAppearance,
        accent,
        setAccent,
        colors,
        currency,
        setCurrency,
        userProfile,
        notificationsEnabled,
        setNotificationsEnabled,
        signOut
    } = useSplittyStore();
    const router = useRouter();

    const isDark = appearance === 'dark';
    const [themeModalVisible, setThemeModalVisible] = useState(false);

    const accentOptions: { name: AccentName; label: string; preview: string }[] = [
        { name: 'classic', label: 'Classic', preview: AccentPalettes.classic.primary },
        { name: 'midnight', label: 'Midnight', preview: AccentPalettes.midnight.primary },
        { name: 'sunset', label: 'Sunset', preview: AccentPalettes.sunset.primary },
        { name: 'forest', label: 'Forest', preview: AccentPalettes.forest.primary },
        { name: 'ruby', label: 'Ruby', preview: AccentPalettes.ruby.primary },
        { name: 'ocean', label: 'Ocean', preview: AccentPalettes.ocean.primary },
        { name: 'sunflower', label: 'Sunflower', preview: AccentPalettes.sunflower.primary },
        { name: 'emerald', label: 'Emerald', preview: AccentPalettes.emerald.primary },
        { name: 'amethyst', label: 'Amethyst', preview: AccentPalettes.amethyst.primary },
        { name: 'rose', label: 'Rose', preview: AccentPalettes.rose.primary },
        { name: 'amber', label: 'Amber', preview: AccentPalettes.amber.primary },
        { name: 'sapphire', label: 'Sapphire', preview: AccentPalettes.sapphire.primary },
        { name: 'fuchsia', label: 'Fuchsia', preview: AccentPalettes.fuchsia.primary },
        { name: 'slate', label: 'Slate', preview: AccentPalettes.slate.primary },
    ];

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

    const handleClearData = async () => {
        Alert.alert(
            "Delete Account",
            "This will delete all friends, groups, and expenses. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Account",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { error } = await supabase.rpc('delete_user_account');
                            if (error) throw error;

                            await signOut();
                            Alert.alert("Account Deleted", "Your account and all associated data have been permanently removed.");
                        } catch (err: any) {
                            Alert.alert("Error Deleting Account", err.message);
                        }
                    }
                }
            ]
        );
    };

    const handleSettleUp = () => {
        router.push('/settle-up');
    };

    const handleSignOut = () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: signOut
                }
            ]
        );
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
                        <View style={[styles.avatar, { backgroundColor: colors.primary + '20', overflow: 'hidden' }]}>
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
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
                    <GlassCard style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
                        {renderSettingItem(
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text }} />,
                            "Dark Mode",
                            <Switch
                                value={isDark}
                                onValueChange={(val) => setAppearance(val ? 'dark' : 'light')}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={'white'}
                            />
                        )}
                    </GlassCard>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Accent Theme</Text>
                    <GlassCard style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
                        {renderSettingItem(
                            <Palette size={20} color={colors.textSecondary} />,
                            "Choose Theme",
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: AccentPalettes[accent].primary }} />
                                <ChevronRight size={20} color={colors.textSecondary} />
                            </View>,
                            () => setThemeModalVisible(true)
                        )}
                    </GlassCard>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>General</Text>
                    <GlassCard style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
                        {renderSettingItem(
                            <Activity size={20} color={colors.textSecondary} />,
                            "Activity Log",
                            <ChevronRight size={20} color={colors.textSecondary} />,
                            () => router.push('/activity-log')
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
                                value={notificationsEnabled}
                                onValueChange={setNotificationsEnabled}
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
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Danger Zone</Text>
                    <GlassCard style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
                        {renderSettingItem(
                            <Trash2 size={20} color={colors.error} />,
                            "Delete Account",
                            <ChevronRight size={20} color={colors.textSecondary} />,
                            handleClearData
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
                            handleSignOut
                        )}
                    </GlassCard>
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.versionText, { color: colors.textSecondary }]}>Splitty v1.0.0</Text>
                    <Text style={[styles.copyrightText, { color: colors.textSecondary }]}>Made with ❤️ by AntiGravity</Text>
                </View>
            </ScrollView>

            <Modal
                visible={themeModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setThemeModalVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Accent Theme</Text>
                            <TouchableOpacity onPress={() => setThemeModalVisible(false)} style={styles.modalCloseButton}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalGrid} showsVerticalScrollIndicator={false}>
                            {accentOptions.map((opt) => (
                                <TouchableOpacity
                                    key={opt.name}
                                    style={[
                                        styles.themeOptionModal,
                                        { borderColor: accent === opt.name ? colors.primary : colors.border },
                                        accent === opt.name && { backgroundColor: colors.primary + '10' }
                                    ]}
                                    onPress={() => {
                                        setAccent(opt.name);
                                        setThemeModalVisible(false);
                                    }}
                                >
                                    <View style={[styles.themePreviewModal, { backgroundColor: opt.preview }]} />
                                    <Text style={[styles.themeLabelModal, { color: accent === opt.name ? colors.primary : colors.text }]}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                            <View style={{ width: '100%', height: 20 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(150,150,150,0.1)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        padding: 20,
    },
    themeOptionModal: {
        width: '30%',
        aspectRatio: 1,
        borderRadius: 12,
        borderWidth: 2,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    themePreviewModal: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginBottom: 8,
    },
    themeLabelModal: {
        fontSize: 12,
        fontWeight: '600',
    },
});
