import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { LightColors, DarkColors, Colors } from '../constants/Colors';
import { GlassCard } from '../components/GlassCard';
import { StyledInput } from '../components/StyledInput';
import { VibrantButton } from '../components/VibrantButton';
import { useSplittyStore } from '../store/useSplittyStore';
import { ChevronRight, Users, Landmark, Check, Plus, Minus, Repeat } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CATEGORIES, CategoryKey } from '../constants/Categories';
import { Frequency } from '../store/useSplittyStore';

export default function AddExpenseScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { friends, groups, addExpense, editExpense, expenses, isDarkMode, formatCurrency } = useSplittyStore();

    const colors = isDarkMode ? DarkColors : LightColors;

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
            return ['self', ...selectedIds];
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

    // Toggle logic
    const toggleSelection = (itemId: string) => {
        if (type === 'group') {
            // Single select for groups
            // If clicking same, deselect? Or just replace? Replace is standard.
            setSelectedIds([itemId]);
        } else {
            // Multi select for individuals
            if (selectedIds.includes(itemId)) {
                setSelectedIds(selectedIds.filter(i => i !== itemId));
            } else {
                setSelectedIds([...selectedIds, itemId]);
            }
        }
    };

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
    // Note: We don't reset when selecting items, only when switching type mainly.
    // Actually, keeping selections when switching tabs might be confusing if lists are disjoint.
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
    const isSplitValid = Math.abs(remainingAmount) < 0.05;

    return (
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
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
                                <Repeat size={20} color={isRecurring ? Colors.primary : colors.textSecondary} />
                                <Text style={[styles.label, { marginBottom: 0, color: isRecurring ? Colors.primary : colors.textSecondary }]}>Repeat this expense</Text>
                            </View>
                            <View style={[styles.checkbox, isRecurring && styles.checkedCheckbox]}>
                                {isRecurring && <Check size={14} color="white" />}
                            </View>
                        </TouchableOpacity>

                        {isRecurring && (
                            <View style={styles.frequencyRow}>
                                {(['daily', 'weekly', 'monthly'] as Frequency[]).map((freq) => (
                                    <TouchableOpacity
                                        key={freq}
                                        style={[styles.freqChip, frequency === freq && styles.activeFreqChip]}
                                        onPress={() => setFrequency(freq)}
                                    >
                                        <Text style={[styles.freqText, frequency === freq && styles.activeFreqText]}>
                                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </GlassCard>

            <Text style={styles.sectionTitle}>Category</Text>
            <View style={{ marginBottom: 24 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat.id}
                            style={[
                                styles.chip,
                                category === cat.id && { backgroundColor: cat.color, borderColor: cat.color }
                            ]}
                            onPress={() => setCategory(cat.id)}
                        >
                            <cat.icon size={16} color={category === cat.id ? 'white' : colors.textSecondary} />
                            <Text style={[
                                styles.chipText,
                                category === cat.id && { color: 'white', fontWeight: 'bold' },
                                { marginLeft: 6 }
                            ]}>
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <Text style={styles.sectionTitle}>Split with</Text>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, type === 'individual' && styles.activeTab]}
                    onPress={() => handleTypeChange('individual')}
                >
                    <Landmark size={20} color={type === 'individual' ? Colors.text : Colors.textSecondary} />
                    <Text style={[styles.tabText, type === 'individual' && styles.activeTabText]}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, type === 'group' && styles.activeTab]}
                    onPress={() => handleTypeChange('group')}
                >
                    <Users size={20} color={type === 'group' ? Colors.text : Colors.textSecondary} />
                    <Text style={[styles.tabText, type === 'group' && styles.activeTabText]}>Groups</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {type === 'individual' ? (
                    friends.map(friend => {
                        const isSelected = selectedIds.includes(friend.id);
                        return (
                            <TouchableOpacity
                                key={friend.id}
                                style={[styles.listItem, isSelected && styles.selectedItem]}
                                onPress={() => toggleSelection(friend.id)}
                            >
                                <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>{friend.name}</Text>
                                <View style={[styles.checkbox, isSelected && styles.checkedCheckbox]}>
                                    {isSelected && <Check size={14} color="white" />}
                                </View>
                            </TouchableOpacity>
                        );
                    })
                ) : (
                    groups.map(group => {
                        const isSelected = selectedIds.includes(group.id);
                        return (
                            <TouchableOpacity
                                key={group.id}
                                style={[styles.listItem, isSelected && styles.selectedItem]}
                                onPress={() => toggleSelection(group.id)}
                            >
                                <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>{group.name}</Text>
                                <View style={[styles.checkbox, isSelected && styles.checkedCheckbox]}>
                                    {isSelected && <Check size={14} color="white" />}
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>

            {selectedIds.length === 0 && (
                <Text style={styles.warningText}>Please select at least one friend or group to split with.</Text>
            )}

            {selectedIds.length > 0 && (
                <View style={styles.advancedSection}>
                    <Text style={styles.sectionTitle}>Details</Text>
                    <GlassCard style={styles.detailsCard}>
                        {/* Payer Selection */}
                        <Text style={styles.label}>Paid by</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {participants.map(pId => (
                                <TouchableOpacity
                                    key={pId}
                                    style={[styles.chip, payerId === pId && styles.activeChip]}
                                    onPress={() => setPayerId(pId)}
                                >
                                    <Text style={[styles.chipText, payerId === pId && styles.activeChipText]}>
                                        {getName(pId)}
                                    </Text>
                                    {payerId === pId && <Check size={14} color="white" style={{ marginLeft: 4 }} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Split Type Selection */}
                        <Text style={[styles.label, { marginTop: 16 }]}>Split distribution</Text>
                        <View style={styles.splitToggle}>
                            <TouchableOpacity
                                style={[styles.toggleOption, splitType === 'equal' && styles.activeToggle]}
                                onPress={() => setSplitType('equal')}
                            >
                                <Text style={[styles.toggleText, splitType === 'equal' && styles.activeToggleText]}>Equally</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleOption, splitType === 'unequal' && styles.activeToggle]}
                                onPress={() => setSplitType('unequal')}
                            >
                                <Text style={[styles.toggleText, splitType === 'unequal' && styles.activeToggleText]}>Unequal</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Unequal Inputs */}
                        {splitType === 'unequal' && (
                            <View style={styles.unequalContainer}>
                                {participants.map(pId => (
                                    <StyledInput
                                        key={pId}
                                        label={getName(pId)}
                                        value={manualAmounts[pId] || ''}
                                        onChangeText={(text) => setManualAmounts(prev => ({ ...prev, [pId]: text }))}
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                    />
                                ))}
                            </View>
                        )}

                        {splitType === 'unequal' && (
                            <View style={styles.splitFeedback}>
                                {Math.abs(remainingAmount) < 0.05 ? (
                                    <View style={styles.feedbackRow}>
                                        <Check size={16} color={Colors.success} />
                                        <Text style={[styles.feedbackText, { color: Colors.success }]}>Perfectly split!</Text>
                                    </View>
                                ) : (
                                    <Text style={[styles.feedbackText, { color: remainingAmount > 0 ? Colors.secondary : Colors.error }]}>
                                        {remainingAmount > 0
                                            ? `Remaining: ${formatCurrency(remainingAmount)}`
                                            : `Over by: ${formatCurrency(Math.abs(remainingAmount))}`
                                        }
                                    </Text>
                                )}
                            </View>
                        )}
                        {splitType === 'equal' && (
                            <Text style={styles.hintText}>
                                Total {formatCurrency(parseFloat(amount || '0'))} will be split equally ({formatCurrency(parseFloat(amount || '0') / participants.length)} / person).
                            </Text>
                        )}
                    </GlassCard>
                </View>
            )}

            <VibrantButton
                title={id ? "Update Expense" : "Save Expense"}
                onPress={handleSave}
                style={styles.saveButton}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        padding: 20,
    },
    card: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
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
        backgroundColor: Colors.primary,
    },
    tabText: {
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: 'white',
    },
    list: {
        marginBottom: 20,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    selectedItem: {
        borderColor: Colors.primary,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    itemText: {
        color: Colors.text,
        fontSize: 16,
    },
    selectedItemText: {
        color: Colors.primary,
        fontWeight: '700',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.textSecondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkedCheckbox: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    advancedSection: {
        marginBottom: 30,
    },
    detailsCard: {
        padding: 16,
    },
    label: {
        color: Colors.textSecondary,
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
    },
    chipScroll: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    chip: {
        backgroundColor: Colors.background,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    activeChip: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    chipText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    activeChipText: {
        color: 'white',
        fontWeight: '600',
    },
    splitToggle: {
        flexDirection: 'row',
        backgroundColor: Colors.background,
        borderRadius: 8,
        padding: 4,
        marginBottom: 16,
    },
    toggleOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 6,
    },
    activeToggle: {
        backgroundColor: Colors.surface,
    },
    toggleText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    activeToggleText: {
        color: Colors.text,
        fontWeight: '600',
    },
    unequalContainer: {
        gap: 12,
        marginTop: 8,
    },
    splitInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    nameContainer: {
        flex: 1,
        paddingRight: 10,
    },
    splitName: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    splitSubtext: {
        color: Colors.textSecondary,
        fontSize: 12,
    },
    smallInput: {
        width: 120,
        textAlign: 'right',
        paddingVertical: 8,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 0,
    },
    hintText: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 8,
    },
    saveButton: {
        marginBottom: 50,
    },
    warningText: {
        color: Colors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 20,
        marginBottom: 20,
    },
    splitFeedback: {
        marginTop: 16,
        alignItems: 'center',
    },
    feedbackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    feedbackText: {
        fontWeight: '600',
        fontSize: 14,
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
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    activeFreqChip: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    freqText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    activeFreqText: {
        color: 'white',
        fontWeight: '600',
    },
});
