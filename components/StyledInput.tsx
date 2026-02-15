import React from 'react';
import { TextInput, StyleSheet, View, Text, TextInputProps, TextStyle, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';

interface StyledInputProps extends TextInputProps {
    label?: string;
    labelStyle?: StyleProp<TextStyle>;
    containerStyle?: StyleProp<ViewStyle>;
}

export const StyledInput: React.FC<StyledInputProps> = ({ label, style, labelStyle, containerStyle, ...props }) => {
    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
            <TextInput
                style={[styles.input, style]}
                placeholderTextColor={Colors.textSecondary}
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
        color: Colors.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#F1F5F9', // Slate 100
        borderRadius: 12,
        padding: 16,
        color: Colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
});
