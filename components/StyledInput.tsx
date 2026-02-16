import React from 'react';
import { TextInput, StyleSheet, View, Text, TextInputProps, TextStyle, StyleProp, ViewStyle } from 'react-native';
import { Themes, ThemeName } from '../constants/Colors';
import { useSplittyStore } from '../store/useSplittyStore';

interface StyledInputProps extends TextInputProps {
    label?: string;
    labelStyle?: StyleProp<TextStyle>;
    containerStyle?: StyleProp<ViewStyle>;
}

export const StyledInput: React.FC<StyledInputProps> = ({ label, style, labelStyle, containerStyle, ...props }) => {
    const colors = useSplittyStore(state => state.colors);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={[styles.label, { color: colors.text }, labelStyle]}>{label}</Text>}
            <TextInput
                style={[styles.input, {
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    borderColor: colors.border
                }, style]}
                placeholderTextColor={colors.textSecondary}
                {...props}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
    },
});
