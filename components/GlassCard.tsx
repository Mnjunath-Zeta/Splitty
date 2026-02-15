import React from 'react';
import { View, StyleSheet, ViewStyle, Platform, StyleProp } from 'react-native';
import { Colors, GlassTheme } from '../constants/Colors';

interface GlassCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
    return (
        <View style={[styles.card, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: GlassTheme.background,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: GlassTheme.border,
        ...Platform.select({
            ios: {
                shadowColor: '#64748B', // Slate 500 shadow
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.1,
                shadowRadius: 16,
            },
            android: {
                elevation: 4,
            },
        }),
    },
});
