import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Themes, ThemeName, Colors } from '../../constants/Colors';
import { GlassCard } from '../../components/GlassCard';
import { StyledInput } from '../../components/StyledInput';
import { VibrantButton } from '../../components/VibrantButton';
import { useSplittyStore } from '../../store/useSplittyStore';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react-native';

export default function GroupsScreen() {
    const router = useRouter();
    const { groups, friends, addGroup, editGroup, deleteGroup, appearance, colors, formatCurrency } = useSplittyStore();
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const isDark = appearance === 'dark';

    const handleSaveGroup = () => {
        if (groupName.trim() && selectedMembers.length > 0) {
            if (editingId) {
                editGroup(editingId, groupName.trim(), selectedMembers);
            } else {
                addGroup(groupName.trim(), selectedMembers);
            }
            resetForm();
        } else {
            Alert.alert('Error', 'Please enter a name and select at least one member');
        }
    };

    const resetForm = () => {
        setGroupName('');
        setSelectedMembers([]);
        setShowAdd(false);
        setEditingId(null);
    };

    const handleEdit = (group: any) => {
        setGroupName(group.name);
        setSelectedMembers(group.members);
        setEditingId(group.id);
        setShowAdd(true);
    };

    const handleDelete = (id: string, name: string) => {
        Alert.alert(
            "Delete Group",
            `Are you sure you want to delete ${name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => deleteGroup(id)
                }
            ]
        );
    };

    const toggleMember = (id: string) => {
        if (selectedMembers.includes(id)) {
            setSelectedMembers(selectedMembers.filter(m => m !== id));
        } else {
            setSelectedMembers([...selectedMembers, id]);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.container}>
                {!showAdd ? (
                    <VibrantButton
                        title="Create New Group"
                        onPress={() => { resetForm(); setShowAdd(true); }}
                        style={{ marginBottom: 20 }}
                    />
                ) : (
                    <GlassCard style={[styles.addCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? 'Edit Group' : 'New Group'}</Text>
                        <StyledInput
                            label="Group Name"
                            placeholder="e.g. Goa Trip"
                            value={groupName}
                            onChangeText={setGroupName}
                            style={{ backgroundColor: colors.inputBackground, color: colors.text }}
                            labelStyle={{ color: colors.text }}
                            placeholderTextColor={colors.textSecondary}
                        />
                        <Text style={[styles.label, { color: colors.text }]}>Select Members</Text>
                        <View style={styles.membersList}>
                            {friends.map(friend => {
                                const isSelected = selectedMembers.includes(friend.id);
                                return (
                                    <TouchableOpacity
                                        key={friend.id}
                                        style={[
                                            styles.memberChip,
                                            {
                                                backgroundColor: isSelected ? colors.primary : colors.surface,
                                                borderColor: isSelected ? colors.primary : colors.border
                                            }
                                        ]}
                                        onPress={() => toggleMember(friend.id)}
                                    >
                                        <Text style={[
                                            styles.memberText,
                                            { color: isSelected ? 'white' : colors.textSecondary }
                                        ]}>
                                            {friend.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View style={styles.actions}>
                            <VibrantButton
                                title="Cancel"
                                onPress={resetForm}
                                variant="outline"
                                style={{ flex: 1, borderColor: colors.border }}
                                textStyle={{ color: colors.text }}
                            />
                            <VibrantButton
                                title={editingId ? "Update" : "Create"}
                                onPress={handleSaveGroup}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </GlassCard>
                )}

                <View style={styles.listContainer}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Groups</Text>
                    <FlatList
                        data={groups}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => router.push({ pathname: '/group-details/[id]', params: { id: item.id } })}
                                activeOpacity={0.8}
                            >
                                <GlassCard style={[styles.groupCard, { backgroundColor: colors.surface }]}>
                                    <View style={[styles.groupIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.inputBackground }]}>
                                        <Users color={colors.textSecondary} size={24} />
                                    </View>
                                    <View style={styles.groupInfo}>
                                        <Text style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
                                        <Text style={[styles.groupMembers, { color: colors.textSecondary }]}>
                                            {item.members.length} members
                                        </Text>
                                    </View>
                                    <View style={styles.rightActions}>
                                        <Text style={[
                                            styles.groupBalance,
                                            { color: item.balance >= 0 ? colors.success : colors.accent, marginRight: 12 }
                                        ]}>
                                            {item.balance >= 0 ? `+${formatCurrency(item.balance)}` : `-${formatCurrency(Math.abs(item.balance))}`}
                                        </Text>
                                        <View style={styles.iconRow}>
                                            <TouchableOpacity
                                                onPress={(e) => { e.stopPropagation(); handleEdit(item); }}
                                                style={styles.actionIcon}
                                            >
                                                <Pencil size={18} color={colors.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={(e) => { e.stopPropagation(); handleDelete(item.id, item.name); }}
                                                style={styles.actionIcon}
                                            >
                                                <Trash2 size={18} color={colors.error} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </GlassCard>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No groups yet.</Text>
                        }
                    />
                </View>
            </View>
        </SafeAreaView>
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
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    membersList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    memberChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    memberText: {
        fontSize: 14,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    listContainer: {
        flex: 1,
    },
    groupCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        padding: 16,
    },
    groupIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        fontSize: 16,
        fontWeight: '600',
    },
    groupMembers: {
        fontSize: 12,
        marginTop: 4,
    },
    rightActions: {
        alignItems: 'flex-end',
    },
    groupBalance: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    iconRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionIcon: {
        padding: 4,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
});
