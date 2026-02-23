import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { BasePalettes } from '../constants/Colors';
import { GlassCard } from '../components/GlassCard';
import { StyledInput } from '../components/StyledInput';
import { VibrantButton } from '../components/VibrantButton';
import { useSplittyStore } from '../store/useSplittyStore';
import { ChevronRight, Users, Landmark, Check, Plus, Minus, Repeat, X, Edit2 } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { CATEGORIES, CategoryKey } from '../constants/Categories';
import { Frequency } from '../store/useSplittyStore';

import { FriendSelector } from '../components/FriendSelector';
import { SplitDetails } from '../components/SplitDetails';

export default function AddExpenseScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { friends, groups, addExpense, editExpense, expenses, appearance, colors, formatCurrency } = useSplittyStore();
    const isDark = appearance === 'dark';

    // Edit Mode State
    // If ID exists, default to VIEW ONLY (false). If ID is missing, we are adding new -> EDITING (true).
    const [isEditing, setIsEditing] = useState(!id);

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<CategoryKey>('general');
    const [type, setType] = useState<'individual' | 'group'>('individual');

    // Changed to Array for Multi-Select
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [payerId, setPayerId] = useState('self');
    const [splitType, setSplitType] = useState<'equal' | 'unequal'>('equal');
    const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});

    // Recurring State
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<Frequency>('monthly');

    // Determine participants
    const getParticipants = () => {
        if (selectedIds.length === 0) return ['self'];

        if (type === 'individual') {
            // Self + All selected friends
            return Array.from(new Set(['self', ...selectedIds]));
        } else {
            // Group (Single selection allowed for groups logic-wise typically, 
            // but if we supported multi-group splits it would be complex. Sticking to 1 group).
            const groupId = selectedIds[0];
            const group = groups.find(g => g.id === groupId);
            return group ? Array.from(new Set(['self', ...group.members])) : ['self'];
        }
    };

    const getName = (userId: string) => {
        if (userId === 'self') return 'You';
        return friends.find(f => f.id === userId)?.name || 'Unknown';
    };

    // Memoized toggle
    const toggleSelection = React.useCallback((itemId: string) => {
        if (type === 'group') {
            setSelectedIds([itemId]);
        } else {
            setSelectedIds(prev => prev.includes(itemId) ? prev.filter(i => i !== itemId) : [...prev, itemId]);
        }
    }, [type]);

    // Initialize Edit Mode
    useEffect(() => {
        if (id) {
            setIsEditing(false); // Reset to view mode when loading an ID
            const expense = expenses.find(e => e.id === id);
            if (expense) {
                setDescription(expense.description);
                setAmount(expense.amount.toString());
                setPayerId(expense.payerId);
                setCategory((expense.category as CategoryKey) || 'general');
                setSplitType(expense.splitType || 'equal');

                if (expense.groupId) {
                    setType('group');
                    setSelectedIds([expense.groupId]);
                } else if (expense.splitWith && expense.splitWith.length > 0) {
                    setType('individual');
                    setSelectedIds(expense.splitWith);
                }

                if (expense.splitDetails) {
                    const stringMap: Record<string, string> = {};
                    Object.entries(expense.splitDetails).forEach(([k, v]) => {
                        stringMap[k] = v.toString();
                    });
                    setManualAmounts(stringMap);
                }


            }
        } else {
            setIsEditing(true); // Default to editing if adding new
        }
    }, [id, expenses]);

    // Reset logic when switching tabs
    const handleTypeChange = (newType: 'individual' | 'group') => {
        setType(newType);
        setSelectedIds([]);
        setPayerId('self');
        setManualAmounts({});
    };

    const handleSave = () => {
        if (!description || !amount || selectedIds.length === 0) {
            Alert.alert('Error', 'Please fill in details and select at least one friend/group');
            return;
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            Alert.alert('Error', 'Invalid amount');
            return;
        }

        const participants = getParticipants();
        const splitDetails: Record<string, number> = {};

        if (splitType === 'unequal') {
            let totalSplit = 0;
            for (const pId of participants) {
                const val = parseFloat(manualAmounts[pId] || '0');
                if (isNaN(val)) {
                    Alert.alert('Error', `Invalid amount for ${getName(pId)}`);
                    return;
                }
                splitDetails[pId] = val;
                totalSplit += val;
            }

            if (Math.abs(totalSplit - numericAmount) > 0.05) {
                Alert.alert('Error', `Split amounts (${formatCurrency(totalSplit)}) must equal total (${formatCurrency(numericAmount)})`);
                return;
            }
        }

        const expenseData = {
            description,
            amount: numericAmount,
            payerId,
            category,
            groupId: type === 'group' ? selectedIds[0] : undefined,
            splitWith: type === 'individual' ? selectedIds : [],
            splitType,
            splitDetails: splitType === 'unequal' ? splitDetails : undefined
        };

        if (id) {
            editExpense(id, expenseData);
        } else {
            addExpense(expenseData);

            if (isRecurring) {
                const { addRecurringExpense } = useSplittyStore.getState();
                addRecurringExpense({
                    ...expenseData,
                    frequency
                });
            }
        }

        router.back();
    };

    const participants = getParticipants();

    // Derived calculations for feedback
    const numericAmount = parseFloat(amount || '0');
    let currentSplitTotal = 0;
    if (splitType === 'unequal') {
        currentSplitTotal = participants.reduce((acc, pId) => {
            return acc + (parseFloat(manualAmounts[pId] || '0') || 0);
        }, 0);
    }
    const remainingAmount = numericAmount - currentSplitTotal;

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.customHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.screenTitle, { color: colors.text }]}>
                        {id ? (isEditing ? 'Edit Expense' : 'Expense Details') : 'New Expense'}
                    </Text>

                    {id && !isEditing ? (
                        <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.closeButton}>
                            <Edit2 size={24} color={colors.primary} />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 24 }} />
                    )}
                </View>

                <GlassCard style={styles.card}>
                    <View style={styles.inputRow}>
                        <StyledInput
                            label="Description"
                            placeholder="What for?"
                            value={description}
                            onChangeText={setDescription}
                            containerStyle={{ flex: 2, marginBottom: 0 }}
                            editable={isEditing}
                        />
                        <View style={styles.gap} />
                        <StyledInput
                            label="Amount"
                            placeholder="0.00"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            containerStyle={{ flex: 1, marginBottom: 0 }}
                            editable={isEditing}
                        />
                    </View>

                </GlassCard>

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Split with</Text>

                <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
                    <TouchableOpacity
                        style={[styles.tab, type === 'individual' && { backgroundColor: colors.primary }, !isEditing && { opacity: 0.7 }]}
                        onPress={() => handleTypeChange('individual')}
                        disabled={!isEditing}
                    >
                        <Landmark size={20} color={type === 'individual' ? 'white' : colors.textSecondary} />
                        <Text style={[styles.tabText, { color: type === 'individual' ? 'white' : colors.textSecondary }]}>Friends</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, type === 'group' && { backgroundColor: colors.primary }, !isEditing && { opacity: 0.7 }]}
                        onPress={() => handleTypeChange('group')}
                        disabled={!isEditing}
                    >
                        <Users size={20} color={type === 'group' ? 'white' : colors.textSecondary} />
                        <Text style={[styles.tabText, { color: type === 'group' ? 'white' : colors.textSecondary }]}>Groups</Text>
                    </TouchableOpacity>
                </View>

                <FriendSelector
                    type={type}
                    friends={friends}
                    groups={groups}
                    selectedIds={selectedIds}
                    onToggle={toggleSelection}
                    disabled={!isEditing}
                />



                <Text style={[styles.sectionTitle, { color: colors.text }]}>Category</Text>
                <View style={{ marginBottom: 24 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.chip,
                                    { backgroundColor: colors.background, borderColor: colors.border },
                                    category === cat.id && { backgroundColor: cat.color, borderColor: cat.color },
                                    !isEditing && { opacity: 0.7 }
                                ]}
                                onPress={() => setCategory(cat.id)}
                                disabled={!isEditing}
                            >
                                <cat.icon size={16} color={category === cat.id ? 'white' : colors.textSecondary} />
                                <Text style={[
                                    styles.chipText,
                                    { color: colors.textSecondary },
                                    category === cat.id && { color: 'white', fontWeight: 'bold' },
                                    { marginLeft: 6 }
                                ]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {
                    selectedIds.length > 0 && (
                        <SplitDetails
                            participants={participants}
                            payerId={payerId}
                            setPayerId={setPayerId}
                            splitType={splitType}
                            setSplitType={setSplitType}
                            manualAmounts={manualAmounts}
                            setManualAmounts={setManualAmounts}
                            remainingAmount={remainingAmount}
                            amount={amount}
                            getName={getName}
                            disabled={!isEditing}
                        />
                    )
                }

                {!id && (
                    <View style={styles.recurringContainer}>
                        <TouchableOpacity
                            style={styles.recurringRow}
                            onPress={() => setIsRecurring(!isRecurring)}
                            activeOpacity={0.8}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Repeat size={20} color={isRecurring ? colors.primary : colors.textSecondary} />
                                <Text style={[styles.label, { marginBottom: 0, color: isRecurring ? colors.primary : colors.textSecondary }]}>Repeat this expense</Text>
                            </View>
                            <View style={[styles.checkbox, { borderColor: colors.textSecondary }, isRecurring && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                                {isRecurring && <Check size={14} color="white" />}
                            </View>
                        </TouchableOpacity>

                        {isRecurring && (
                            <View style={styles.frequencyRow}>
                                {(['daily', 'weekly', 'monthly'] as Frequency[]).map((freq) => (
                                    <TouchableOpacity
                                        key={freq}
                                        style={[
                                            styles.freqChip,
                                            { borderColor: colors.border },
                                            frequency === freq && { backgroundColor: colors.primary, borderColor: colors.primary }
                                        ]}
                                        onPress={() => setFrequency(freq)}
                                    >
                                        <Text style={[styles.freqText, { color: colors.textSecondary }, frequency === freq && { color: 'white', fontWeight: '600' }]}>
                                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {isEditing && (
                    <VibrantButton
                        title={id ? "Update Expense" : "Save Expense"}
                        onPress={handleSave}
                        style={styles.saveButton}
                    />
                )}
            </ScrollView >
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16, // Reduced from 20
    },
    header: {
        marginBottom: 16, // Reduced from 20
    },
    card: {
        marginBottom: 16, // Reduced from 24
    },
    sectionTitle: {
        fontSize: 17, // Slightly smaller
        fontWeight: '700',
        marginBottom: 12, // Reduced from 16
    },
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        marginBottom: 12, // Reduced from 16
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10, // Reduced from 12
        gap: 6,
        borderRadius: 8,
    },
    activeTab: {
    },
    tabText: {
        fontWeight: '600',
        fontSize: 14,
    },
    activeTabText: {
        color: 'white',
    },
    saveButton: {
        marginBottom: 40,
    },
    label: {
        fontSize: 14,
        marginBottom: 6, // Reduced
        fontWeight: '600',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipScroll: {
        flexDirection: 'row',
        marginBottom: 4, // Reduced
    },
    chip: {
        paddingHorizontal: 14, // Reduced
        paddingVertical: 8,
        borderRadius: 18,
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    chipText: {
        fontSize: 13, // Reduced
    },
    warningText: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 16,
        marginBottom: 16,
    },
    recurringContainer: {
        marginTop: 12, // Reduced
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(150,150,150,0.1)',
        marginBottom: 24, // Added to fix overlap with Save button
    },
    recurringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6, // Reduced
    },
    frequencyRow: {
        flexDirection: 'row',
        marginTop: 8, // Reduced
        gap: 8,
    },
    freqChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6, // Reduced
        borderRadius: 8,
        borderWidth: 1,
    },
    activeFreqChip: {
    },
    freqText: {
        fontSize: 12,
    },
    activeFreqText: {
        color: 'white',
        fontWeight: '600',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    gap: {
        width: 12,
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        marginTop: Platform.OS === 'android' ? 40 : 10,
    },
    closeButton: {
        padding: 4,
    },
    screenTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
});
