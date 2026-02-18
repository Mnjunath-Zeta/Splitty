import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ScrollView, Image, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSplittyStore } from '../../store/useSplittyStore';
import { GlassCard } from '../../components/GlassCard';
import { ArrowLeft, User, Banknote, Trash2, Users, Mail, Phone, ChevronRight } from 'lucide-react-native';
import { getCategoryById } from '../../constants/Categories';
import { supabase } from '../../lib/supabase';

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
                    <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.inputBackground, overflow: 'hidden' }]}>
                        {friend.avatarUrl ? (
                            <Image source={{ uri: friend.avatarUrl }} style={styles.avatarImage} />
                        ) : (
                            <User size={32} color={colors.primary} />
                        )}
                    </View>
                    <Text style={[styles.friendName, { color: colors.text }]}>{friend.name}</Text>

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
                                <GlassCard style={[styles.activityItem, { backgroundColor: colors.surface }]}>
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
                                            {expense.payerId === 'self' ? 'You paid' : `${expense.payerId === friend.id ? friend.name : 'Someone'} paid`}
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
});
