import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Themes, ThemeName } from '../constants/Colors';
import { useSplittyStore } from '../store/useSplittyStore';

interface VibrantButtonProps {
    title: string;
    onPress: () => void;
    style?: ViewStyle;
    textStyle?: TextStyle;
    variant?: 'primary' | 'secondary' | 'outline';
    disabled?: boolean;
}

export const VibrantButton: React.FC<VibrantButtonProps> = ({
    title,
    onPress,
    style,
    textStyle,
    variant = 'primary',
    disabled = false
}) => {
    const colors = useSplittyStore(state => state.colors);
    const isOutline = variant === 'outline';
    const isSecondary = variant === 'secondary';

    const buttonStyle = [
        styles.button,
        isOutline ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary } :
            isSecondary ? { backgroundColor: colors.secondary } :
                { backgroundColor: colors.primary },
        disabled && { backgroundColor: colors.border, borderColor: colors.border },
        style
    ];

    const textColor = isOutline ? colors.primary : (disabled ? colors.textSecondary : colors.text);
    const finalTextColor = isOutline ? colors.primary : (disabled ? colors.textSecondary : colors.text);

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            activeOpacity={0.8}
            disabled={disabled}
        >
            <Text style={[
                styles.text,
                { color: finalTextColor },
                textStyle
            ]}>
                {title}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({

    button: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        fontWeight: '700',
    },
});
