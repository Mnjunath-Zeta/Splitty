import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSplittyStore } from '../store/useSplittyStore';
import { Themes, ThemeName, Colors } from '../constants/Colors';
import { GlassCard } from '../components/GlassCard';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { getCategoryById } from '../constants/Categories';

export default function AnalyticsScreen() {
    const router = useRouter();
    const { expenses, friends, groups, appearance, colors, formatCurrency } = useSplittyStore();
    const isDark = appearance === 'dark';
    const { width } = Dimensions.get('window');

    // 1. Spending by Category (Pie Chart)
    const categorySpending: Record<string, number> = {};
    expenses.forEach(e => {
        if (e.isSettlement) return;
        categorySpending[e.category] = (categorySpending[e.category] || 0) + e.amount;
    });

    const pieData = Object.entries(categorySpending).map(([catId, amount]) => {
        const category = getCategoryById(catId);
        return {
            value: amount,
            color: category.color,
            text: `${((amount / Object.values(categorySpending).reduce((a, b) => a + b, 0)) * 100).toFixed(0)}%`,
            categoryName: category.label,
            amount: amount
        };
    }).sort((a, b) => b.value - a.value);

    // 2. Monthly Spending (Bar Chart) - Last 6 months
    const monthlySpending: Record<string, number> = {};
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthlySpending[key] = 0;
        months.push({ key, label: d.toLocaleString('default', { month: 'short' }) });
    }

    expenses.forEach(e => {
        if (e.isSettlement) return;
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (monthlySpending[key] !== undefined) {
            monthlySpending[key] += e.amount;
        }
    });

    const barData = months.map(m => ({
        value: monthlySpending[m.key],
        label: m.label,
        frontColor: colors.primary,
        topLabelComponent: () => (
            <Text style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 6 }}>
                {monthlySpending[m.key] > 0 ? formatCurrency(monthlySpending[m.key]) : ''}
            </Text>
        )
    }));

    const totalSpent = Object.values(categorySpending).reduce((a, b) => a + b, 0);
    const maxMonthly = Math.max(...Object.values(monthlySpending));

    // 3. Friend-wise spending
    const friendSpending: Record<string, number> = {};
    expenses.forEach(e => {
        if (e.isSettlement) return;
        if (e.splitType === 'unequal' && e.splitDetails) {
            Object.entries(e.splitDetails).forEach(([id, amount]) => {
                if (id !== 'self') {
                    friendSpending[id] = (friendSpending[id] || 0) + amount;
                }
            });
        } else if (e.splitWith) {
            const share = e.amount / (e.splitWith.length + 1);
            e.splitWith.forEach(id => {
                friendSpending[id] = (friendSpending[id] || 0) + share;
            });
        }
    });

    const friendSpendData = Object.entries(friendSpending).map(([id, amount]) => {
        const friend = friends.find(f => f.id === id);
        return {
            name: friend?.name || 'Unknown',
            amount: amount,
            percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0
        };
    }).sort((a, b) => b.amount - a.amount).slice(0, 5); // Top 5

    // 4. Group-wise spending
    const groupSpending: Record<string, number> = {};
    expenses.forEach(e => {
        if (e.isSettlement || !e.groupId) return;
        groupSpending[e.groupId] = (groupSpending[e.groupId] || 0) + e.amount;
    });

    const groupSpendData = Object.entries(groupSpending).map(([id, amount]) => {
        const group = groups.find(g => g.id === id);
        return {
            name: group?.name || 'Unknown',
            amount: amount,
        };
    }).sort((a, b) => b.amount - a.amount).slice(0, 5);

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                {/* Overview Cards */}
                <View style={styles.overviewRow}>
                    <GlassCard style={[styles.overviewCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Spent</Text>
                        <Text style={[styles.summaryAmount, { color: colors.text }]}>{formatCurrency(totalSpent)}</Text>
                    </GlassCard>
                </View>

                {/* Monthly Trend */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Trend</Text>
                <GlassCard style={[styles.chartCard, { backgroundColor: colors.surface }]}>
                    {maxMonthly > 0 ? (
                        <BarChart
                            data={barData}
                            barWidth={22}
                            spacing={20}
                            roundedTop
                            roundedBottom
                            hideRules
                            xAxisThickness={0}
                            yAxisThickness={0}
                            yAxisTextStyle={{ color: colors.textSecondary }}
                            noOfSections={4}
                            maxValue={maxMonthly * 1.2}
                            height={180}
                            width={width - 80}
                            xAxisLabelTextStyle={{ color: colors.textSecondary }}
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={{ color: colors.textSecondary }}>No data available</Text>
                        </View>
                    )}
                </GlassCard>

                {/* Category Breakdown */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Category Breakdown</Text>
                <GlassCard style={[styles.chartCard, { backgroundColor: colors.surface }]}>
                    {pieData.length > 0 ? (
                        <View>
                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <PieChart
                                    data={pieData}
                                    donut
                                    showGradient
                                    radius={85}
                                    innerRadius={55}
                                    innerCircleColor={colors.surface}
                                    centerLabelComponent={() => (
                                        <View style={{ alignItems: 'center' }}>
                                            <Text style={{ fontSize: 20, color: colors.text, fontWeight: 'bold' }}>{pieData.length}</Text>
                                            <Text style={{ fontSize: 10, color: colors.textSecondary }}>Categories</Text>
                                        </View>
                                    )}
                                />
                            </View>
                            {pieData.map((item, index) => (
                                <View key={index} style={styles.rankingItem}>
                                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.rankingHeader}>
                                            <Text style={[styles.rankingName, { color: colors.text }]}>{item.categoryName}</Text>
                                            <Text style={[styles.rankingAmount, { color: colors.text }]}>{formatCurrency(item.amount)}</Text>
                                        </View>
                                        <View style={[styles.progressBarBase, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                                            <View style={[styles.progressBarFill, { backgroundColor: item.color, width: `${(item.amount / totalSpent) * 100}%` }]} />
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={{ color: colors.textSecondary }}>No categories yet</Text>
                        </View>
                    )}
                </GlassCard>

                {/* Friend-wise Breakdown */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Spend Split with Friends</Text>
                <GlassCard style={[styles.chartCard, { backgroundColor: colors.surface }]}>
                    {friendSpendData.length > 0 ? (
                        friendSpendData.map((item, index) => (
                            <View key={index} style={styles.rankingItem}>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.rankingHeader}>
                                        <Text style={[styles.rankingName, { color: colors.text }]}>{item.name}</Text>
                                        <Text style={[styles.rankingAmount, { color: colors.text }]}>{formatCurrency(item.amount)}</Text>
                                    </View>
                                    <View style={[styles.progressBarBase, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                                        <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${item.percentage}%` }]} />
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={{ color: colors.textSecondary }}>No shared expenses yet</Text>
                        </View>
                    )}
                </GlassCard>

                {/* Group Activity */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Spending by Group</Text>
                <GlassCard style={[styles.chartCard, { backgroundColor: colors.surface }]}>
                    {groupSpendData.length > 0 ? (
                        groupSpendData.map((item, index) => (
                            <View key={index} style={styles.rankingItem}>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.rankingHeader}>
                                        <Text style={[styles.rankingName, { color: colors.text }]}>{item.name}</Text>
                                        <Text style={[styles.rankingAmount, { color: colors.text }]}>{formatCurrency(item.amount)}</Text>
                                    </View>
                                    <View style={[styles.progressBarBase, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                                        <View style={[styles.progressBarFill, { backgroundColor: colors.secondary, width: `${(item.amount / totalSpent) * 100}%` }]} />
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={{ color: colors.textSecondary }}>No group expenses yet</Text>
                        </View>
                    )}
                </GlassCard>

                <View style={{ height: 60 }} />
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
    overviewRow: {
        marginBottom: 24,
    },
    overviewCard: {
        padding: 24,
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        marginBottom: 8,
    },
    summaryAmount: {
        fontSize: 32,
        fontWeight: '800',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    chartCard: {
        padding: 20,
        overflow: 'hidden',
    },
    emptyContainer: {
        height: 150,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    rankingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    rankingName: {
        fontSize: 14,
        fontWeight: '600',
    },
    rankingAmount: {
        fontSize: 14,
        fontWeight: '700',
    },
    progressBarBase: {
        height: 8,
        borderRadius: 4,
        width: '100%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    legendColor: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
        marginTop: -16, // Align with text
    },
});
