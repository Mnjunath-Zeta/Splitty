import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useSplittyStore } from '../store/useSplittyStore';
import { GlassCard } from './GlassCard';
import { StyledInput } from './StyledInput';
import { Friend, Group } from '../store/useSplittyStore';

interface SplitDetailsProps {
    participants: string[];
    payerId: string;
    setPayerId: (id: string) => void;
    splitType: 'equal' | 'unequal';
    setSplitType: (type: 'equal' | 'unequal') => void;
    manualAmounts: Record<string, string>;
    setManualAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    remainingAmount: number;
    amount: string;
    getName: (id: string) => string;
}

export const SplitDetails = memo(({
    participants,
    payerId,
    setPayerId,
    splitType,
    setSplitType,
    manualAmounts,
    setManualAmounts,
    remainingAmount,
    amount,
    getName
}: SplitDetailsProps) => {
    const colors = useSplittyStore(state => state.colors);
    const formatCurrency = useSplittyStore(state => state.formatCurrency);

    return (
        <View style={styles.advancedSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
            <GlassCard style={styles.detailsCard}>
                {/* Payer Selection */}
                <Text style={[styles.label, { color: colors.textSecondary }]}>Paid by</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {participants.map(pId => (
                        <TouchableOpacity
                            key={pId}
                            style={[
                                styles.chip,
                                { backgroundColor: colors.background, borderColor: colors.border },
                                payerId === pId && { backgroundColor: colors.primary, borderColor: colors.primary }
                            ]}
                            onPress={() => setPayerId(pId)}
                        >
                            <Text style={[
                                styles.chipText,
                                { color: colors.textSecondary },
                                payerId === pId && { color: 'white', fontWeight: '600' }
                            ]}>
                                {getName(pId)}
                            </Text>
                            {payerId === pId && <Check size={14} color="white" style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Split Type Selection */}
                <Text style={[styles.label, { marginTop: 16, color: colors.textSecondary }]}>Split distribution</Text>
                <View style={[styles.splitToggle, { backgroundColor: colors.background }]}>
                    <TouchableOpacity
                        style={[styles.toggleOption, splitType === 'equal' && { backgroundColor: colors.surface }]}
                        onPress={() => setSplitType('equal')}
                    >
                        <Text style={[styles.toggleText, { color: colors.textSecondary }, splitType === 'equal' && { color: colors.text, fontWeight: '600' }]}>Equally</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleOption, splitType === 'unequal' && { backgroundColor: colors.surface }]}
                        onPress={() => setSplitType('unequal')}
                    >
                        <Text style={[styles.toggleText, { color: colors.textSecondary }, splitType === 'unequal' && { color: colors.text, fontWeight: '600' }]}>Unequal</Text>
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
                                <Check size={16} color={colors.success} />
                                <Text style={[styles.feedbackText, { color: colors.success }]}>Perfectly split!</Text>
                            </View>
                        ) : (
                            <Text style={[styles.feedbackText, { color: remainingAmount > 0 ? colors.secondary : colors.error }]}>
                                {remainingAmount > 0
                                    ? `Remaining: ${formatCurrency(remainingAmount)}`
                                    : `Over by: ${formatCurrency(Math.abs(remainingAmount))}`
                                }
                            </Text>
                        )}
                    </View>
                )}
                {splitType === 'equal' && (
                    <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                        Total {formatCurrency(parseFloat(amount || '0'))} will be split equally ({formatCurrency(parseFloat(amount || '0') / participants.length)} / person).
                    </Text>
                )}
            </GlassCard>
        </View>
    );
});

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    advancedSection: {
        marginBottom: 30,
    },
    detailsCard: {
        padding: 16,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '600',
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
    splitToggle: {
        flexDirection: 'row',
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
    toggleText: {
        fontSize: 14,
    },
    unequalContainer: {
        gap: 12,
        marginTop: 8,
    },
    hintText: {
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 8,
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
});
