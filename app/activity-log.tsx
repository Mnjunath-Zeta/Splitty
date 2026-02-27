import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Clock, Activity, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSplittyStore, ActivityLog } from '../store/useSplittyStore';
import { GlassCard } from '../components/GlassCard';

export default function ActivityLogScreen() {
    const { colors, isDarkMode, activities, expenses, fetchData, formatCurrency } = useSplittyStore();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const filteredActivities = activities.filter(activity => {
        if (activity.entity_type === 'expense') {
            const expense = expenses.find(e => e.id === activity.entity_id);
            if (expense?.isPersonal) return false;
        }
        return true;
    });

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return 'Just now';
    };

    const renderItem = ({ item }: { item: ActivityLog }) => {
        const isExpense = item.entity_type === 'expense';
        const isGroup = item.entity_type === 'group';
        const meta = item.metadata || {};

        const handlePress = () => {
            // 1. If it's a deletion, show alert (no navigation)
            if (item.action === 'deleted' || item.action === 'removed_member' || item.action === 'left_group') {
                Alert.alert("Notice", "This item has been deleted or you are no longer a member.");
                return;
            }

            // 2. Navigate based on type
            if (isExpense) {
                // Check if expense still exists in store? 
                // It's safer to just try navigating. If AddExpense handles "ID not found" gracefully (it does logic check), it might show error or empty form.
                // Better: Check store first.
                const exists = useSplittyStore.getState().expenses.some(e => e.id === item.entity_id);
                if (exists) {
                    router.push({ pathname: "/add-expense", params: { id: item.entity_id } });
                } else {
                    Alert.alert("Unavailable", "This expense seems to have been deleted.");
                }
            } else if (isGroup) {
                const exists = useSplittyStore.getState().groups.some(g => g.id === item.entity_id);
                if (exists) {
                    router.push({ pathname: "/group-details/[id]", params: { id: item.entity_id } });
                } else {
                    Alert.alert("Unavailable", "This group is no longer available.");
                }
            }
        };

        return (
            <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
                <GlassCard style={styles.card}>
                    <View style={styles.cardContent}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
                            {isExpense ? (
                                <Activity size={20} color={colors.primary} />
                            ) : isGroup ? (
                                <Users size={20} color={colors.secondary || '#4bc0c0'} />
                            ) : (
                                <Activity size={20} color={colors.textSecondary} />
                            )}
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={[styles.description, { color: colors.text }]}>
                                {(() => {
                                    let desc = item.description;
                                    if (isExpense) {
                                        // 1. "You added 'Paid Manasa'" -> "You settled 'Manasa'"
                                        desc = desc.replace(/^You added 'Paid (.*)'$/, "You settled '$1'");

                                        // 2. "You added 'Manasa paid you'" -> "Manasa settled with you"
                                        desc = desc.replace(/^You added '(.*) paid you'$/, "$1 settled with you");

                                        // 3. "Manasa added you to 'Paid ...'" -> "Manasa settled with you"
                                        desc = desc.replace(/^(.*) added you to 'Paid .*'$/, "$1 settled with you");

                                        // 4. "Manasa added you to '... paid you'" -> "Manasa settled with you"
                                        desc = desc.replace(/^(.*) added you to '.* paid you'$/, "$1 settled with you");
                                    }
                                    return desc;
                                })()}
                            </Text>

                            {/* Rich Details Row */}
                            {(meta.amount !== undefined || meta.group_name) && (
                                <View style={styles.detailsContainer}>
                                    {meta.amount !== undefined && (
                                        <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                                            <Text style={[styles.badgeText, { color: colors.primary }]}>
                                                {meta.payer_name ? `${meta.payer_name} paid ` : ''}
                                                {formatCurrency(Number(meta.amount))}
                                            </Text>
                                        </View>
                                    )}
                                    {meta.group_name && (
                                        <View style={[styles.badge, { backgroundColor: colors.textSecondary + '15' }]}>
                                            <Text style={[styles.badgeText, { color: colors.text }]}>
                                                {meta.group_name}
                                            </Text>
                                        </View>
                                    )}
                                    {meta.participants && meta.participants.length > 0 && (
                                        <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                                            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                                                With: {meta.participants.join(', ')}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={styles.metaContainer}>
                                <Clock size={12} color={colors.textSecondary} />
                                <Text style={[styles.time, { color: colors.textSecondary }]}>
                                    {formatTime(item.created_at)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </GlassCard>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.backButton, { backgroundColor: colors.surface }]}
                >
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Activity Log</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={filteredActivities}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Activity size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No activity yet
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    listContent: {
        padding: 20,
        paddingTop: 10,
    },
    card: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    description: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 6,
        lineHeight: 22,
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    detailsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    time: {
        fontSize: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        gap: 16,
    },
    emptyText: {
        fontSize: 16,
    }
});
