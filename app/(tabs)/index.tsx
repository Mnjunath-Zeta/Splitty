import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Themes, ThemeName } from '../../constants/Colors';
import { GlassCard } from '../../components/GlassCard';
import { VibrantButton } from '../../components/VibrantButton';
import { useRouter } from 'expo-router';
import { useSplittyStore } from '../../store/useSplittyStore';
import { Trash2, Banknote } from 'lucide-react-native';
import { getCategoryById } from '../../constants/Categories';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';

export default function DashboardScreen() {
    const router = useRouter();
    const { friends, expenses, deleteExpense, appearance, colors, formatCurrency, userProfile, fetchData } = useSplittyStore();
    const isDark = appearance === 'dark';
    const [refreshing, setRefreshing] = useState(false);

    const owed = friends.reduce((acc, f) => f.balance > 0 ? acc + f.balance : acc, 0);
    const owe = friends.reduce((acc, f) => f.balance < 0 ? acc + Math.abs(f.balance) : acc, 0);

    // Filter and Sort Expenses for Recent Activity
    const recentExpenses = [...expenses]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

    const handleDelete = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            "Delete Expense",
            "Are you sure you want to delete this expense?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteExpense(id)
                }
            ]
        );
    };

    const getPayerName = (id: string) => {
        if (id === 'self') return 'You';
        return friends.find(f => f.id === id)?.name || 'Someone';
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                <View style={styles.header}>
                    <Text style={[styles.greeting, { color: colors.text }]}>Hello, {userProfile.name?.split(' ')[0] || 'Manjunath'}!</Text>
                    <Text style={[styles.subGreeting, { color: colors.textSecondary }]}>
                        {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
                    </Text>
                </View>

                <View style={styles.summaryRow}>
                    <GlassCard style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>You are owed</Text>
                        <Text style={[styles.summaryAmount, { color: colors.success }]}>{formatCurrency(owed)}</Text>
                    </GlassCard>

                    <GlassCard style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>You owe</Text>
                        <Text style={[styles.summaryAmount, { color: colors.accent }]}>{formatCurrency(owe)}</Text>
                    </GlassCard>
                </View>

                <VibrantButton
                    title="Add New Expense"
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push('/add-expense');
                    }}
                    style={styles.addButton}
                />

                <VibrantButton
                    title="View Analytics"
                    onPress={() => router.push('/analytics')}
                    variant="outline"
                    style={styles.analyticsButton}
                />

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
                        <TouchableOpacity onPress={() => router.push('/activity')}>
                            <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    {recentExpenses.length > 0 ? (
                        recentExpenses.map(expense => (
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
                                        <Text style={[styles.activityDate, { color: colors.textSecondary }]}>
                                            {new Date(expense.date).toLocaleDateString()}
                                        </Text>
                                        <Text style={[styles.paidByText, { color: colors.textSecondary }]}>
                                            {getPayerName(expense.payerId)} paid
                                        </Text>
                                    </View>
                                    <View style={styles.activityRight}>
                                        <Text style={[styles.activityAmount, { color: colors.text }]}>{formatCurrency(expense.amount)}</Text>
                                        <TouchableOpacity
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleDelete(expense.id);
                                            }}
                                            hitSlop={10}
                                        >
                                            <Trash2 size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                </GlassCard>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <GlassCard style={[styles.activityCard, { backgroundColor: colors.surface }]}>
                            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>No recent activity yet. Start spliting bills!</Text>
                        </GlassCard>
                    )}
                </View>


            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        padding: 20,
    },
    header: {
        marginBottom: 30,
        alignItems: 'flex-start',
    },
    greeting: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    subGreeting: {
        fontSize: 16,
        fontWeight: '500',
        marginTop: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    totalAmount: {
        fontSize: 48,
        fontWeight: '800',
        marginTop: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    summaryCard: {
        width: '48%',
        padding: 16,
    },
    iconContainer: {
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    summaryAmount: {
        fontSize: 18,
        fontWeight: '700',
    },
    section: {
        marginBottom: 30,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    seeAll: {
        fontSize: 14,
        fontWeight: '600',
    },
    activityCard: {
        padding: 40,
    },
    activityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        marginBottom: 8,
    },
    activityRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    activityDesc: {
        fontSize: 16,
        fontWeight: '600',
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityDate: {
        fontSize: 12,
        marginTop: 4,
    },
    activityAmount: {
        fontSize: 16,
        fontWeight: '700',
    },
    paidByText: {
        fontSize: 12,
        marginTop: 4,
        fontStyle: 'italic',
    },
    addButton: {
        marginBottom: 12,
    },
    analyticsButton: {
        marginBottom: 30,
        borderColor: 'rgba(150,150,150,0.5)',
    },
});
