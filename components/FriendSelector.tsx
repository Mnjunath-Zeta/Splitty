import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Friend, Group, useSplittyStore } from '../store/useSplittyStore';

interface FriendSelectorProps {
    type: 'individual' | 'group';
    friends: Friend[];
    groups: Group[];
    selectedIds: string[];
    onToggle: (id: string) => void;
}

export const FriendSelector = memo(({ type, friends, groups, selectedIds, onToggle }: FriendSelectorProps) => {
    const colors = useSplittyStore(state => state.colors);
    const appearance = useSplittyStore(state => state.appearance);
    const isDark = appearance === 'dark';

    const items = type === 'individual' ? friends : groups;

    return (
        <View style={styles.list}>
            {items.map(item => {
                const isSelected = selectedIds.includes(item.id);
                return (
                    <TouchableOpacity
                        key={item.id}
                        style={[
                            styles.listItem,
                            { backgroundColor: colors.surface },
                            isSelected && { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)' }
                        ]}
                        onPress={() => onToggle(item.id)}
                    >
                        <Text style={[styles.itemText, { color: colors.text }, isSelected && { color: colors.primary, fontWeight: '700' }]}>
                            {item.name}
                        </Text>
                        <View style={[
                            styles.checkbox,
                            { borderColor: colors.textSecondary },
                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}>
                            {isSelected && <Check size={14} color="white" />}
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
});

const styles = StyleSheet.create({
    list: {
        marginBottom: 20,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    itemText: {
        fontSize: 16,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
