import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ScrollView, Image, Linking, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSplittyStore } from '../../store/useSplittyStore';
import { GlassCard } from '../../components/GlassCard';
import { ArrowLeft, Banknote, Trash2, Users, Mail, Phone, ChevronRight, Edit2, X, Camera } from 'lucide-react-native';
import { getCategoryById } from '../../constants/Categories';
import { supabase } from '../../lib/supabase';
import { InitialsAvatar } from '../../components/InitialsAvatar';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

interface LinkedProfile {
    email?: string;
    phone?: string;
    full_name?: string;
    avatar_url?: string;
}

export default function FriendDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { friends, expenses, groups, appearance, colors, formatCurrency, deleteExpense, deleteFriend } = useSplittyStore();
    const isDark = appearance === 'dark';

    const friend = friends.find(f => f.id === id);
    const [linkedProfile, setLinkedProfile] = useState<LinkedProfile | null>(null);

    // Edit Modal State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAvatarUrl, setEditAvatarUrl] = useState<string | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch linked user's profile (email/phone) if they are a registered user
    useEffect(() => {
        if (friend?.linkedUserId) {
            supabase
                .from('profiles')
                .select('email, phone, full_name, avatar_url')
                .eq('id', friend.linkedUserId)
                .single()
                .then(({ data }) => {
                    if (data) setLinkedProfile(data);
                });
        }
    }, [friend?.linkedUserId]);

    // Filter activities involving this friend
    const friendExpenses = expenses.filter(e => {
        const isPayer = e.payerId === id;
        const inSplitWith = e.splitWith?.includes(id);
        const inSplitDetails = e.splitDetails && Object.keys(e.splitDetails).includes(id);
        let inGroup = false;
        if (e.groupId) {
            const group = groups.find(g => g.id === e.groupId);
            if (group && group.members.includes(id)) inGroup = true;
        }
        return isPayer || inSplitWith || inSplitDetails || inGroup;
    });

    const sortedExpenses = [...friendExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (!friend) {
        return (
            <>
                <Stack.Screen options={{ headerShown: false }} />
                <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
                    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: colors.textSecondary }}>Friend not found.</Text>
                        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                            <Text style={{ color: colors.primary }}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </>
        );
    }

    const getGroupName = (groupId?: string) => {
        if (!groupId) return null;
        return groups.find(g => g.id === groupId)?.name;
    };

    const handleDeleteExpense = (expenseId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            "Delete Expense",
            "Are you sure you want to delete this expense?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteExpense(expenseId) }
            ]
        );
    };

    const handleDeleteFriend = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            "Remove Friend",
            `Are you sure you want to remove ${friend.name}? Their shared expenses will also be removed from your activity.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                        deleteFriend(friend.id);
                        router.back();
                    }
                }
            ]
        );
    };

    const displayEmail = linkedProfile?.email;
    const displayPhone = linkedProfile?.phone;
    const isLinked = !!friend.linkedUserId;

    const openEditModal = () => {
        setEditName(friend.name);
        setEditAvatarUrl(friend.avatarUrl);
        setIsEditing(true);
    };

    const handlePickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert('Permission to access camera roll is required!');
            return;
        }

        const pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
            setEditAvatarUrl(pickerResult.assets[0].uri);
        }
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            Alert.alert("Error", "Name cannot be empty");
            return;
        }
        setIsSaving(true);
        try {
            // For a robust implementation, we'd upload `editAvatarUrl` to Supabase Storage if it's a local file URI (e.g. file://...)
            // Since there's no storage bucket mentioned in the prompt, we are temporarily relying on the local base64/file URI, 
            // which works perfectly offline but won't be visible to others.
            // If the user wants a true cloud upload, we would upload to a bucket and pass the public URL here.

            // Call the store action and await to catch DB errors
            await useSplittyStore.getState().editFriend(friend.id, editName.trim(), editAvatarUrl);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsEditing(false);
        } catch (e: any) {
            Alert.alert("Error saving profile", e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Friend Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container}>

                {/* Profile Card */}
                <GlassCard style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.avatarEditContainer}>
                        <InitialsAvatar
                            name={friend.name}
                            avatarUrl={friend.avatarUrl}
                            size={72}
                            isLocal={!isLinked}
                        />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.friendName, { color: colors.text, marginBottom: 0 }]}>{friend.name}</Text>
                        {!isLinked && (
                            <TouchableOpacity onPress={openEditModal} style={styles.editIconBtn}>
                                <Edit2 size={16} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={{ height: 8 }} />

                    {isLinked && (
                        <View style={[styles.linkedBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.linkedBadgeText, { color: colors.primary }]}>✓ Splitty User</Text>
                        </View>
                    )}

                    {/* Contact Info */}
                    {(displayEmail || displayPhone) && (
                        <View style={[styles.contactSection, { borderTopColor: colors.border }]}>
                            {displayEmail && (
                                <TouchableOpacity
                                    style={styles.contactRow}
                                    onPress={() => Linking.openURL(`mailto:${displayEmail}`)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.contactIcon, { backgroundColor: colors.primary + '15' }]}>
                                        <Mail size={16} color={colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Email</Text>
                                        <Text style={[styles.contactValue, { color: colors.text }]}>{displayEmail}</Text>
                                    </View>
                                    <ChevronRight size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                            {displayPhone && (
                                <TouchableOpacity
                                    style={[styles.contactRow, displayEmail && { borderTopWidth: 1, borderTopColor: colors.border }]}
                                    onPress={() => Linking.openURL(`tel:${displayPhone}`)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.contactIcon, { backgroundColor: colors.success + '15' }]}>
                                        <Phone size={16} color={colors.success} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Phone</Text>
                                        <Text style={[styles.contactValue, { color: colors.text }]}>{displayPhone}</Text>
                                    </View>
                                    <ChevronRight size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Balance */}
                    <View style={[styles.balanceContainer, { borderTopColor: colors.border }]}>
                        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                            {friend.balance >= 0 ? "Owes you" : "You owe"}
                        </Text>
                        <Text style={[styles.balanceAmount, { color: friend.balance >= 0 ? colors.success : colors.accent }]}>
                            {formatCurrency(Math.abs(friend.balance))}
                        </Text>
                    </View>
                </GlassCard>

                {/* Activity History */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity History</Text>

                {sortedExpenses.length > 0 ? (
                    sortedExpenses.map(expense => {
                        const groupName = getGroupName(expense.groupId);
                        return (
                            <TouchableOpacity
                                key={expense.id}
                                activeOpacity={0.7}
                                onPress={() => router.push({ pathname: '/add-expense', params: { id: expense.id } })}
                            >
                                <GlassCard style={[
                                    styles.activityItem,
                                    { backgroundColor: colors.surface },
                                    { borderLeftWidth: 3, borderLeftColor: expense.isSettlement ? colors.success : getCategoryById(expense.category).color }
                                ]}>
                                    <View style={[
                                        styles.categoryIcon,
                                        { backgroundColor: expense.isSettlement ? colors.success + '20' : getCategoryById(expense.category).color + '20' }
                                    ]}>
                                        {expense.isSettlement ? (
                                            <Banknote size={20} color={colors.success} />
                                        ) : (
                                            (() => {
                                                const CategoryIcon = getCategoryById(expense.category).icon;
                                                return <CategoryIcon size={20} color={getCategoryById(expense.category).color} />;
                                            })()
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.activityDesc, { color: colors.text }]}>{expense.description}</Text>
                                        <View style={styles.metaRow}>
                                            <Text style={[styles.activityDate, { color: colors.textSecondary }]}>
                                                {new Date(expense.date).toLocaleDateString()}
                                            </Text>
                                            {groupName && (
                                                <View style={[styles.groupTag, { backgroundColor: colors.inputBackground }]}>
                                                    <Users size={10} color={colors.textSecondary} style={{ marginRight: 4 }} />
                                                    <Text style={[styles.groupTagText, { color: colors.textSecondary }]}>{groupName}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.paidByText, { color: colors.textSecondary }]}>
                                            {expense.payerId === 'self' ? 'You paid' : `${expense.payerName || (expense.payerId === friend.id ? friend.name : 'Someone')} paid`}
                                        </Text>
                                    </View>
                                    <View style={styles.activityRight}>
                                        <Text style={[styles.activityAmount, { color: colors.text }]}>{formatCurrency(expense.amount)}</Text>
                                        <TouchableOpacity
                                            onPress={(e) => { e.stopPropagation(); handleDeleteExpense(expense.id); }}
                                            hitSlop={10}
                                        >
                                            <Trash2 size={18} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                </GlassCard>
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    <GlassCard style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No shared activity yet.</Text>
                    </GlassCard>
                )}

                {/* Danger Zone */}
                <View style={[styles.dangerZone, { borderColor: colors.error + '40' }]}>
                    <Text style={[styles.dangerTitle, { color: colors.error }]}>Danger Zone</Text>
                    <TouchableOpacity
                        style={[styles.deleteButton, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]}
                        onPress={handleDeleteFriend}
                        activeOpacity={0.7}
                    >
                        <Trash2 size={18} color={colors.error} />
                        <Text style={[styles.deleteButtonText, { color: colors.error }]}>Remove {friend.name}</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal
                visible={isEditing}
                transparent={true}
                animationType="slide"
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.modalCloseBtn}>
                                <X size={24} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
                            <View style={{ width: 24 }} />
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                            <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} style={styles.editAvatarPicker}>
                                    <InitialsAvatar
                                        name={editName || friend.name}
                                        avatarUrl={editAvatarUrl}
                                        size={96}
                                        isLocal={!isLinked}
                                    />
                                    <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
                                        <Camera size={16} color="#FFF" />
                                    </View>
                                </TouchableOpacity>
                                <Text style={[styles.editAvatarHint, { color: colors.textSecondary }]}>Tap to change photo</Text>
                            </View>

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Friend's Name"
                                placeholderTextColor={colors.textSecondary}
                                returnKeyType="done"
                                onSubmitEditing={handleSaveProfile}
                            />

                            <TouchableOpacity
                                style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
                                onPress={handleSaveProfile}
                                disabled={isSaving}
                            >
                                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    container: { padding: 20, paddingTop: 0 },
    summaryCard: {
        alignItems: 'center',
        padding: 24,
        marginBottom: 24,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    avatarEditContainer: {
        marginBottom: 16,
        position: 'relative',
    },
    editIconBtn: {
        padding: 4,
    },
    avatarImage: { width: '100%', height: '100%' },
    friendName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    linkedBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 16,
    },
    linkedBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    contactSection: {
        width: '100%',
        borderTopWidth: 1,
        marginTop: 8,
        paddingTop: 8,
        marginBottom: 8,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    contactIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginBottom: 2,
    },
    contactValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    balanceContainer: {
        alignItems: 'center',
        width: '100%',
        paddingTop: 16,
        marginTop: 8,
        borderTopWidth: 1,
    },
    balanceLabel: { fontSize: 14, marginBottom: 4 },
    balanceAmount: { fontSize: 32, fontWeight: '800' },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityDesc: { fontSize: 16, fontWeight: '600' },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        flexWrap: 'wrap',
        gap: 8,
    },
    activityDate: { fontSize: 12 },
    groupTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    groupTagText: { fontSize: 10, fontWeight: '500' },
    paidByText: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
    activityRight: { alignItems: 'flex-end', gap: 8 },
    activityAmount: { fontSize: 16, fontWeight: '700' },
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: { fontSize: 14 },
    dangerZone: {
        marginTop: 32,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
    },
    dangerTitle: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    deleteButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        borderRadius: 24,
        paddingBottom: 24,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(150,150,150,0.2)',
    },
    modalCloseBtn: { padding: 4 },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    modalBody: { padding: 24 },
    editAvatarPicker: {
        position: 'relative',
        marginBottom: 12,
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
    },
    editAvatarHint: {
        fontSize: 13,
        fontWeight: '500',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        height: 52,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 24,
    },
    saveButton: {
        height: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
