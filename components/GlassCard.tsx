import React from 'react';
import { View, StyleSheet, ViewStyle, Platform, StyleProp } from 'react-native';
import { Themes, ThemeName } from '../constants/Colors';
import { useSplittyStore } from '../store/useSplittyStore';

interface GlassCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
    const appearance = useSplittyStore(state => state.appearance);
    const isDark = appearance === 'dark';

    const glassStyle: ViewStyle = {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    };

    return (
        <View style={[styles.card, glassStyle, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
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
