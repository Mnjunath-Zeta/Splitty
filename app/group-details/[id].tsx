import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSplittyStore } from '../../store/useSplittyStore';
import { Themes, ThemeName, Colors } from '../../constants/Colors';
import { GlassCard } from '../../components/GlassCard';
import { ArrowLeft, Users, Receipt, Banknote, Trash2 } from 'lucide-react-native';
import { getCategoryById } from '../../constants/Categories';
import { InitialsAvatar } from '../../components/InitialsAvatar';

export default function GroupDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { groups, expenses, friends, appearance, colors, formatCurrency, deleteExpense, userProfile } = useSplittyStore();
    const isDark = appearance === 'dark';

    const group = groups.find(g => g.id === id);
    // Filter expenses belonging to this group
    const groupExpenses = expenses.filter(e => e.groupId === id);

    // Sort expenses by date desc
    const sortedExpenses = groupExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate member contributions (excluding settlements)
    const contributions: Record<string, number> = {};
    groupExpenses.forEach(e => {
        if (e.isSettlement) return;
        const payer = e.payerId;
        contributions[payer] = (contributions[payer] || 0) + e.amount;
    });

    const totalGroupSpending = Object.values(contributions).reduce((a, b) => a + b, 0);

    if (!group) {
        return (
            <>
                <Stack.Screen options={{ headerShown: false }} />
                <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
                    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: colors.textSecondary }}>Group not found.</Text>
                        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                            <Text style={{ color: colors.primary }}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </>
        );
    }

    const getMemberName = (id: string) => {
        if (id === 'self') return 'You';
        return friends.find(f => f.id === id)?.name || 'Unknown';
    };

    const handleDeleteExpense = (expenseId: string) => {
        Alert.alert(
            "Delete Expense",
            "Are you sure you want to delete this expense?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteExpense(expenseId)
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Group Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {/* Group Summary Card */}
                <GlassCard style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                    <View style={[styles.groupIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.inputBackground }]}>
                        <Users size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                    <Text style={[styles.memberCount, { color: colors.textSecondary }]}>{group.members.length + 1} members (inc. you)</Text>

                    <View style={styles.balanceContainer}>
                        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Your Balance</Text>
                        <Text style={[
                            styles.balanceAmount,
                            { color: group.balance >= 0 ? colors.success : colors.accent }
                        ]}>
                            {group.balance >= 0 ? `+${formatCurrency(group.balance)}` : `-${formatCurrency(Math.abs(group.balance))}`}
                        </Text>
                        <Text style={[styles.balanceSub, { color: colors.textSecondary }]}>
                            {group.balance >= 0 ? 'You are owed in total' : 'You start settling up'}
                        </Text>
                    </View>
                </GlassCard>

                {/* Contributions Card */}
                <GlassCard style={[styles.contributionsCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Spending Summary</Text>
                    <View style={styles.contributionRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <InitialsAvatar
                                name={userProfile.name || 'You'}
                                avatarUrl={userProfile.avatar}
                                size={32}
                            />
                            <View style={{ width: 10 }} />
                            <Text style={[styles.contributionName, { color: colors.text }]}>You</Text>
                        </View>
                        <Text style={[styles.contributionAmount, { color: colors.text }]}>
                            {formatCurrency(contributions['self'] || 0)}
                        </Text>
                    </View>
                    {group.members.filter(mId => mId !== 'self').map(mId => (
                        <View key={mId} style={styles.contributionRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <InitialsAvatar
                                    name={getMemberName(mId)}
                                    avatarUrl={friends.find(f => f.id === mId)?.avatarUrl}
                                    size={32}
                                    isLocal={!friends.find(f => f.id === mId)?.linkedUserId}
                                />
                                <View style={{ width: 10 }} />
                                <Text style={[styles.contributionName, { color: colors.text }]}>{getMemberName(mId)}</Text>
                            </View>
                            <Text style={[styles.contributionAmount, { color: colors.text }]}>
                                {formatCurrency(contributions[mId] || 0)}
                            </Text>
                        </View>
                    ))}
                    <View style={[styles.totalRow, { borderColor: colors.border }]}>
                        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
                        <Text style={[styles.totalAmount, { color: colors.text }]}>{formatCurrency(totalGroupSpending)}</Text>
                    </View>
                </GlassCard>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
                <View style={styles.membersRow}>
                    <View style={styles.memberItem}>
                        <View style={{ marginBottom: 8 }}>
                            <InitialsAvatar
                                name={userProfile.name || 'You'}
                                avatarUrl={userProfile.avatar}
                                size={48}
                            />
                        </View>
                        <Text style={[styles.memberName, { color: colors.text }]}>You</Text>
                    </View>
                    {group.members.filter(mId => mId !== 'self').map(mId => (
                        <View key={mId} style={styles.memberItem}>
                            <View style={{ marginBottom: 8 }}>
                                <InitialsAvatar
                                    name={getMemberName(mId)}
                                    avatarUrl={friends.find(f => f.id === mId)?.avatarUrl}
                                    size={48}
                                    isLocal={!friends.find(f => f.id === mId)?.linkedUserId}
                                />
                            </View>
                            <Text style={[styles.memberName, { color: colors.text }]}>{getMemberName(mId)}</Text>
                        </View>
                    ))}
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Expenses</Text>

                {sortedExpenses.length > 0 ? (
                    sortedExpenses.map(expense => (
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
                                    <Text style={[styles.activitySub, { color: colors.textSecondary }]}>
                                        {getMemberName(expense.payerId)} paid • {new Date(expense.date).toLocaleDateString()}
                                    </Text>
                                </View>
                                <View style={styles.activityRight}>
                                    <Text style={[styles.activityAmount, { color: colors.text }]}>{formatCurrency(expense.amount)}</Text>
                                    <TouchableOpacity
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleDeleteExpense(expense.id);
                                        }}
                                        hitSlop={10}
                                    >
                                        <Trash2 size={18} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            </GlassCard>
                        </TouchableOpacity>
                    ))
                ) : (
                    <GlassCard style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                        <Receipt size={40} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No expenses in this group yet.</Text>
                    </GlassCard>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView >
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
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    container: {
        padding: 20,
        paddingTop: 0,
    },
    summaryCard: {
        alignItems: 'center',
        padding: 24,
        marginBottom: 24,
    },
    groupIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    groupName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    memberCount: {
        fontSize: 14,
        marginBottom: 20,
    },
    balanceContainer: {
        alignItems: 'center',
        width: '100%',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(150,150,150,0.1)',
    },
    balanceLabel: {
        fontSize: 14,
        marginBottom: 4,
    },
    balanceAmount: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 4,
    },
    balanceSub: {
        fontSize: 12,
    },
    contributionsCard: {
        padding: 20,
        marginBottom: 24,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
    },
    contributionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    smallAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    avatarText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: 'white',
    },
    contributionName: {
        fontSize: 14,
        fontWeight: '500',
    },
    contributionAmount: {
        fontSize: 14,
        fontWeight: '600',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    totalAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    membersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    memberItem: {
        alignItems: 'center',
        width: 60,
    },
    memberAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    memberName: {
        fontSize: 12,
        textAlign: 'center',
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
    activityDesc: {
        fontSize: 16,
        fontWeight: '600',
    },
    activitySub: {
        fontSize: 12,
        marginTop: 4,
    },
    activityRight: {
        alignItems: 'flex-end',
        gap: 8,
    },
    activityAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 16,
    },
    emptyText: {
        fontSize: 14,
    },
});
