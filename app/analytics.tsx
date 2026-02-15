import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSplittyStore } from '../store/useSplittyStore';
import { LightColors, DarkColors } from '../constants/Colors';
import { GlassCard } from '../components/GlassCard';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { getCategoryById } from '../constants/Categories';

export default function AnalyticsScreen() {
    const router = useRouter();
    const { expenses, isDarkMode, formatCurrency } = useSplittyStore();
    const colors = isDarkMode ? DarkColors : LightColors;
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

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {/* Total Spending Summary */}
                <GlassCard style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Spending (All Time)</Text>
                    <Text style={[styles.summaryAmount, { color: colors.text }]}>{formatCurrency(totalSpent)}</Text>
                </GlassCard>

                {/* Monthly Trend */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Spending Trend</Text>
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
                            height={200}
                            width={width - 80}
                            xAxisLabelTextStyle={{ color: colors.textSecondary }}
                        />
                    ) : (
                        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: colors.textSecondary }}>No data yet</Text>
                        </View>
                    )}
                </GlassCard>

                {/* Category Breakdown */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Spending by Category</Text>
                <GlassCard style={[styles.chartCard, { backgroundColor: colors.surface, alignItems: 'center' }]}>
                    {pieData.length > 0 ? (
                        <View style={{ alignItems: 'center' }}>
                            <PieChart
                                data={pieData}
                                donut
                                showGradient
                                sectionAutoFocus
                                radius={90}
                                innerRadius={60}
                                innerCircleColor={colors.surface}
                                centerLabelComponent={() => {
                                    return (
                                        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 22, color: colors.text, fontWeight: 'bold' }}>
                                                {pieData.length}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Categories</Text>
                                        </View>
                                    );
                                }}
                            />
                            {/* Legend */}
                            <View style={styles.legendContainer}>
                                {pieData.map((item, index) => (
                                    <View key={index} style={styles.legendItem}>
                                        <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                                        <Text style={[styles.legendText, { color: colors.text }]}>{item.categoryName}</Text>
                                        <Text style={[styles.legendAmount, { color: colors.textSecondary }]}>
                                            {formatCurrency(item.amount)} ({item.text})
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: colors.textSecondary }}>No data yet</Text>
                        </View>
                    )}
                </GlassCard>

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
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
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
    legendContainer: {
        marginTop: 24,
        width: '100%',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    legendColor: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    legendText: {
        fontSize: 14,
        flex: 1,
    },
    legendAmount: {
        fontSize: 14,
        fontWeight: '600',
    },
});
