import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert, TextInput, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSplittyStore } from '../store/useSplittyStore';
import { Themes, ThemeName, Colors } from '../constants/Colors';
import { GlassCard } from '../components/GlassCard';
import { ArrowLeft, Search, Trash2, Banknote, Users } from 'lucide-react-native';
import { getCategoryById } from '../constants/Categories';
import * as Haptics from 'expo-haptics';

export default function ActivityScreen() {
    const router = useRouter();
    const { expenses, friends, groups, appearance, colors, formatCurrency, deleteExpense, fetchData } = useSplittyStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const isDark = appearance === 'dark';

    // Filter and Sort Expenses
    const getFilteredExpenses = () => {
        let filtered = [...expenses];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                e.description.toLowerCase().includes(query) ||
                (e.amount && e.amount.toString().includes(query)) ||
                (e.payerId === 'self' ? 'you' : friends.find(f => f.id === e.payerId)?.name || '').toLowerCase().includes(query)
            );
        }

        // Sort by Date Desc
        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const filteredExpenses = getFilteredExpenses();

    const getPayerName = (id: string) => {
        if (id === 'self') return 'You';
        return friends.find(f => f.id === id)?.name || 'Unknown';
    };

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

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>All Activity</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
                    <Search size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search expenses..."
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.searchInput, { color: colors.text }]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <FlatList
                data={filteredExpenses}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push({ pathname: '/add-expense', params: { id: item.id } })}
                    >
                        <GlassCard style={[
                            styles.activityItem,
                            { backgroundColor: colors.surface },
                            { borderLeftWidth: 3, borderLeftColor: item.isSettlement ? colors.success : getCategoryById(item.category).color }
                        ]}>
                            <View style={[
                                styles.categoryIcon,
                                { backgroundColor: item.isSettlement ? colors.success + '20' : getCategoryById(item.category).color + '20' }
                            ]}>
                                {item.isSettlement ? (
                                    <Banknote size={20} color={colors.success} />
                                ) : (
                                    (() => {
                                        const CategoryIcon = getCategoryById(item.category).icon;
                                        return <CategoryIcon size={20} color={getCategoryById(item.category).color} />;
                                    })()
                                )}
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.activityDesc, { color: colors.text }]}>{item.description}</Text>
                                <View style={styles.metaRow}>
                                    <Text style={[styles.activityDate, { color: colors.textSecondary }]}>
                                        {new Date(item.date).toLocaleDateString()}
                                    </Text>
                                    {item.groupId && (
                                        <View style={[styles.groupTag, { backgroundColor: colors.inputBackground }]}>
                                            <Users size={10} color={colors.textSecondary} style={{ marginRight: 4 }} />
                                            <Text style={[styles.groupTagText, { color: colors.textSecondary }]}>
                                                {groups.find(g => g.id === item.groupId)?.name}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.paidByText, { color: colors.textSecondary }]}>
                                    {getPayerName(item.payerId)} paid
                                </Text>
                            </View>
                            <View style={styles.activityRight}>
                                <Text style={[styles.activityAmount, { color: colors.text }]}>{formatCurrency(item.amount)}</Text>
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item.id);
                                    }}
                                    hitSlop={10}
                                >
                                    <Trash2 size={18} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        </GlassCard>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={{ color: colors.textSecondary }}>No activity found.</Text>
                    </View>
                }
            />
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
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    listContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
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
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
});
