import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSplittyStore } from '../../store/useSplittyStore';
import { LightColors, DarkColors } from '../../constants/Colors';
import { GlassCard } from '../../components/GlassCard';
import { ArrowLeft, User, Banknote, Trash2, Users } from 'lucide-react-native';
import { getCategoryById } from '../../constants/Categories';

export default function FriendDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { friends, expenses, groups, isDarkMode, formatCurrency, deleteExpense } = useSplittyStore();

    const colors = isDarkMode ? DarkColors : LightColors;

    const friend = friends.find(f => f.id === id);

    // Filter activities involving this friend
    // 1. Friend is Payer.
    // 2. User is Payer and Friend is in splitDetails.
    // 3. Friend is in splitDetails (Group expense paid by someone else, where friend is involved? Store doesn't store this explicitly without full member list check). 
    // Wait, Store logic:
    // `splitDetails` keys are `friendId` or `self`.
    // So if Friend is in `splitDetails` keys, they are involved.
    // Or if Friend is `payerId`.

    const friendExpenses = expenses.filter(e => {
        // Exclude settlements for general "Activity" list? 
        // User asked for "all the activities where this friend was in" and "open for edit".
        // Settlements ARE activities.

        const isPayer = e.payerId === id;
        const isInvolved = e.splitDetails && Object.keys(e.splitDetails).includes(id);

        // Also if User paid and Friend is involved. (isInvolved covers this if splitDetails has friendId)
        // If Friend paid and User is involved (User is in splitDetails).
        // If Third party paid? Store only tracks "User" perspective usually unless fully group aware.
        // Assuming `expenses` contains all group expenses too.

        return isPayer || isInvolved;
    });

    // Sort by date desc
    const sortedExpenses = friendExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
                <Text style={[styles.headerTitle, { color: colors.text }]}>Friend Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {/* Friend Summary Card */}
                <GlassCard style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                    <View style={[styles.avatar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : colors.inputBackground }]}>
                        <User size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.friendName, { color: colors.text }]}>{friend.name}</Text>

                    <View style={styles.balanceContainer}>
                        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                            {friend.balance >= 0 ? "Owes you" : "You owe"}
                        </Text>
                        <Text style={[
                            styles.balanceAmount,
                            { color: friend.balance >= 0 ? colors.success : colors.accent }
                        ]}>
                            {formatCurrency(Math.abs(friend.balance))}
                        </Text>
                    </View>
                </GlassCard>

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
                        );
                    })
                ) : (
                    <GlassCard style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No shared activity yet.</Text>
                    </GlassCard>
                )}

                <View style={{ height: 40 }} />
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
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    friendName: {
        fontSize: 24,
        fontWeight: 'bold',
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
    },
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
    activityDesc: {
        fontSize: 16,
        fontWeight: '600',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        flexWrap: 'wrap',
        gap: 8,
    },
    activityDate: {
        fontSize: 12,
    },
    groupTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    groupTagText: {
        fontSize: 10,
        fontWeight: '500',
    },
    paidByText: {
        fontSize: 12,
        marginTop: 4,
        fontStyle: 'italic',
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
    },
    emptyText: {
        fontSize: 14,
    },
});
