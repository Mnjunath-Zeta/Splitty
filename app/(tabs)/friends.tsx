import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LightColors, DarkColors } from '../../constants/Colors';
import { GlassCard } from '../../components/GlassCard';
import { StyledInput } from '../../components/StyledInput';
import { VibrantButton } from '../../components/VibrantButton';
import { useSplittyStore } from '../../store/useSplittyStore';
import { UserPlus, User, Trash2, Banknote } from 'lucide-react-native';

export default function FriendsScreen() {
    const router = useRouter();
    const { friends, addFriend, deleteFriend, isDarkMode, formatCurrency, settleUp } = useSplittyStore();
    const [newName, setNewName] = useState('');

    const colors = isDarkMode ? DarkColors : LightColors;

    const handleAddFriend = () => {
        if (newName.trim()) {
            addFriend(newName.trim());
            setNewName('');
        }
    };

    const handleDelete = (id: string, name: string) => {
        Alert.alert(
            "Delete Friend",
            `Are you sure you want to remove ${name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteFriend(id)
                }
            ]
        );
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
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Add New Friend</Text>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <StyledInput
                                placeholder="Friend's Name"
                                value={newName}
                                onChangeText={setNewName}
                                style={{ marginBottom: 0, backgroundColor: colors.inputBackground, color: colors.text }}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>
                        <View style={styles.addButtonWrapper}>
                            <VibrantButton
                                title=""
                                onPress={handleAddFriend}
                                style={styles.smallAddButton}
                                variant="primary"
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
                                    <View style={[styles.avatar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : colors.inputBackground }]}>
                                        <User color={colors.textSecondary} size={24} />
                                    </View>
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
                                                onPress={(e) => { e.stopPropagation(); handleSettleUp(item); }}
                                                style={styles.actionButton}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Banknote size={20} color={colors.success} />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={(e) => { e.stopPropagation(); handleDelete(item.id, item.name); }}
                                            style={styles.actionButton}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Trash2 size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                </GlassCard>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No friends added yet.</Text>
                        }
                        contentContainerStyle={{ paddingBottom: 20 }}
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
