import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert, Image, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Themes, ThemeName, Colors } from '../../constants/Colors';
import { GlassCard } from '../../components/GlassCard';
import { StyledInput } from '../../components/StyledInput';
import { VibrantButton } from '../../components/VibrantButton';
import { useSplittyStore } from '../../store/useSplittyStore';
import { UserPlus, Banknote } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { InitialsAvatar } from '../../components/InitialsAvatar';
import * as Haptics from 'expo-haptics';

export default function FriendsScreen() {
    const router = useRouter();
    const { friends, addFriend, appearance, colors, formatCurrency, settleUp, fetchData } = useSplittyStore();
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const isDark = appearance === 'dark';

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleAddFriend = async () => {
        if (!inputValue.trim()) return;
        setLoading(true);

        const input = inputValue.trim();
        let foundUser: any = null;

        try {
            // Check if input looks like email
            if (input.includes('@')) {
                const { data, error } = await supabase.rpc('lookup_user_by_email', { search_email: input });
                if (data) foundUser = data;
            }
            // Check if input looks like phone (digits > 9)
            else if (input.replace(/\D/g, '').length >= 10) {
                const { data, error } = await supabase.rpc('lookup_user_by_phone', { search_phone: input });
                if (data) foundUser = data;
            }

            if (foundUser) {
                Alert.alert(
                    "User Found!",
                    `Add ${foundUser.full_name || 'User'} (${input}) as a friend?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Add Friend",
                            onPress: () => {
                                addFriend(foundUser.full_name || input, foundUser.id);
                                setInputValue('');
                            }
                        }
                    ]
                );
            } else {
                // Not found - Ask to add as local-only
                Alert.alert(
                    "User Not Found",
                    `We couldn't find a registered user with ${input}. Add as a local-only friend?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Add Local Friend",
                            onPress: () => {
                                addFriend(input);
                                setInputValue('');
                            }
                        }
                    ]
                );
            }
        } catch (err) {
            console.log(err);
            Alert.alert("Error", "Something went wrong searching for user.");
        } finally {
            setLoading(false);
        }
    };



    const handleSettleUp = (friend: { id: string, name: string, balance: number }) => {
        const amount = Math.abs(friend.balance);
        const isUserOwed = friend.balance > 0;

        Alert.alert(
            "Settle Up",
            isUserOwed
                ? `Did ${friend.name} pay you ${formatCurrency(amount)}?`
                : `Did you pay ${friend.name} ${formatCurrency(amount)}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Settle Up",
                    style: "default",
                    onPress: () => {
                        if (isUserOwed) {
                            settleUp(friend.id, 'self', amount);
                        } else {
                            settleUp('self', friend.id, amount);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.container}>
                <GlassCard style={[styles.addCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Friend</Text>
                    <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13 }}>
                        Search by email or phone to link real users. If not found, they'll be added locally.
                    </Text>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <StyledInput
                                placeholder="Name, Email or Phone"
                                value={inputValue}
                                onChangeText={setInputValue}
                                style={{ marginBottom: 0, backgroundColor: colors.inputBackground, color: colors.text }}
                                placeholderTextColor={colors.textSecondary}
                                autoCapitalize="none"
                            />
                        </View>
                        <View style={styles.addButtonWrapper}>
                            <VibrantButton
                                title=""
                                onPress={handleAddFriend}
                                style={styles.smallAddButton}
                                variant="primary"
                                disabled={loading}
                            />
                            <View style={styles.plusIcon}>
                                <UserPlus color="white" size={20} />
                            </View>
                        </View>
                    </View>
                </GlassCard>

                <View style={styles.listContainer}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Friends</Text>
                    <FlatList
                        data={friends}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.cardWrapper}
                                activeOpacity={0.8}
                                onPress={() => router.push({ pathname: '/friend-details/[id]', params: { id: item.id } })}
                            >
                                <GlassCard style={[styles.friendCard, { backgroundColor: colors.surface }]}>
                                    <InitialsAvatar
                                        name={item.name}
                                        avatarUrl={item.avatarUrl}
                                        size={44}
                                    />
                                    <View style={styles.friendInfo}>
                                        <Text style={[styles.friendName, { color: colors.text }]}>{item.name}</Text>
                                        <Text style={[
                                            styles.friendBalance,
                                            { color: item.balance >= 0 ? colors.success : colors.accent }
                                        ]}>
                                            {item.balance >= 0 ? `Owes you ${formatCurrency(item.balance)}` : `You owe ${formatCurrency(Math.abs(item.balance))}`}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        {Math.abs(item.balance) > 0.01 && (
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    handleSettleUp(item);
                                                }}
                                                style={styles.actionButton}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Banknote size={20} color={colors.success} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </GlassCard>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No friends added yet.</Text>
                        }
                        contentContainerStyle={{ paddingBottom: 20 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.primary}
                            />
                        }
                    />
                </View>
            </View >
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        padding: 20,
    },
    addCard: {
        marginBottom: 24,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    addButtonWrapper: {
        position: 'relative',
        width: 50,
        height: 50,
    },
    smallAddButton: {
        width: 50,
        height: 50,
        paddingVertical: 0,
        paddingHorizontal: 0,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusIcon: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
    },
    listContainer: {
        flex: 1,
    },
    cardWrapper: {
        marginBottom: 12,
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
    },
    friendBalance: {
        fontSize: 14,
        marginTop: 4,
    },
    actionButton: {
        padding: 8,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
});
