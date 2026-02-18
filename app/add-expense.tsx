import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { BasePalettes } from '../constants/Colors';
import { GlassCard } from '../components/GlassCard';
import { StyledInput } from '../components/StyledInput';
import { VibrantButton } from '../components/VibrantButton';
import { useSplittyStore } from '../store/useSplittyStore';
import { ChevronRight, Users, Landmark, Check, Plus, Minus, Repeat } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CATEGORIES, CategoryKey } from '../constants/Categories';
import { Frequency } from '../store/useSplittyStore';

import { FriendSelector } from '../components/FriendSelector';
import { SplitDetails } from '../components/SplitDetails';

export default function AddExpenseScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { friends, groups, addExpense, editExpense, expenses, appearance, colors, formatCurrency } = useSplittyStore();
    const isDark = appearance === 'dark';

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
            return group ? ['self', ...group.members] : ['self'];
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

                router.setParams({ title: 'Edit Expense' });
            }
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
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
            <GlassCard style={styles.card}>
                <StyledInput
                    label="Description"
                    placeholder="What was it for?"
                    value={description}
                    onChangeText={setDescription}
                />
                <StyledInput
                    label="Amount"
                    placeholder="0.00"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                />

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
            </GlassCard>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Category</Text>
            <View style={{ marginBottom: 24 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat.id}
                            style={[
                                styles.chip,
                                { backgroundColor: colors.background, borderColor: colors.border },
                                category === cat.id && { backgroundColor: cat.color, borderColor: cat.color }
                            ]}
                            onPress={() => setCategory(cat.id)}
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

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Split with</Text>

            <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                    style={[styles.tab, type === 'individual' && { backgroundColor: colors.primary }]}
                    onPress={() => handleTypeChange('individual')}
                >
                    <Landmark size={20} color={type === 'individual' ? 'white' : colors.textSecondary} />
                    <Text style={[styles.tabText, { color: type === 'individual' ? 'white' : colors.textSecondary }]}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, type === 'group' && { backgroundColor: colors.primary }]}
                    onPress={() => handleTypeChange('group')}
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
            />

            {
                selectedIds.length === 0 && (
                    <Text style={[styles.warningText, { color: colors.textSecondary }]}>Please select at least one friend or group to split with.</Text>
                )
            }

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
                    />
                )
            }

            <VibrantButton
                title={id ? "Update Expense" : "Save Expense"}
                onPress={handleSave}
                style={styles.saveButton}
            />
        </ScrollView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 20,
    },
    card: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
        borderRadius: 8,
    },
    activeTab: {
    },
    tabText: {
        fontWeight: '600',
    },
    activeTabText: {
        color: 'white',
    },
    saveButton: {
        marginBottom: 50,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
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
        marginBottom: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    chipText: {
        fontSize: 14,
    },
    warningText: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 20,
        marginBottom: 20,
    },
    recurringContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(150,150,150,0.1)',
    },
    recurringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    frequencyRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    freqChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
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
});
