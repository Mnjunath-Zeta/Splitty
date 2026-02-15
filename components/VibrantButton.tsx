import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../constants/Colors';

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
    const isOutline = variant === 'outline';
    const isSecondary = variant === 'secondary';

    return (
        <TouchableOpacity
            style={[
                styles.button,
                isOutline ? styles.outlineButton : isSecondary ? styles.secondaryButton : styles.primaryButton,
                disabled && styles.disabledButton,
                style
            ]}
            onPress={onPress}
            activeOpacity={0.8}
            disabled={disabled}
        >
            <Text style={[
                styles.text,
                isOutline ? styles.outlineText : styles.text,
                disabled && styles.disabledText,
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
    primaryButton: {
        backgroundColor: Colors.primary,
    },
    secondaryButton: {
        backgroundColor: Colors.secondary,
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    text: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
    },
    outlineText: {
        color: Colors.primary,
    },
    disabledButton: {
        backgroundColor: Colors.border,
        borderColor: Colors.border,
    },
    disabledText: {
        color: Colors.textSecondary,
    },
});
