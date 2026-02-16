import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { Themes, ThemeName } from '../../constants/Colors';
import { GlassCard } from '../../components/GlassCard';
import { VibrantButton } from '../../components/VibrantButton';
import { useRouter } from 'expo-router';
import { useSplittyStore } from '../../store/useSplittyStore';
import { Trash2, Banknote } from 'lucide-react-native';
import { getCategoryById } from '../../constants/Categories';

export default function DashboardScreen() {
    const router = useRouter();
    const { friends, expenses, deleteExpense, appearance, colors, formatCurrency } = useSplittyStore();
    const isDark = appearance === 'dark';

    const owed = friends.reduce((acc, f) => f.balance > 0 ? acc + f.balance : acc, 0);
    const owe = friends.reduce((acc, f) => f.balance < 0 ? acc + Math.abs(f.balance) : acc, 0);

    const handleDelete = (id: string) => {
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

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.header}>
                    <Text style={[styles.greeting, { color: colors.textSecondary }]}>Hello, Manjunath!</Text>
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
                    onPress={() => router.push('/add-expense')}
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

                    {expenses.length > 0 ? (
                        expenses.slice(0, 5).map(expense => (
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
                                        <Text style={[styles.activityDate, { color: colors.textSecondary }]}>{new Date(expense.date).toLocaleDateString()}</Text>
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
        alignItems: 'center',
    },
    greeting: {
        fontSize: 16,
        marginBottom: 8,
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
    addButton: {
        marginBottom: 12,
    },
    analyticsButton: {
        marginBottom: 30,
        borderColor: 'rgba(150,150,150,0.5)',
    },
});
