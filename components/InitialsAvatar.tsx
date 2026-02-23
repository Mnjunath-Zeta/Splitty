import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

// Deterministic color from name — same name always gets same color
const AVATAR_COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
    '#F97316', '#EAB308', '#22C55E', '#14B8A6',
    '#0EA5E9', '#3B82F6',
];

function getColorForName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface InitialsAvatarProps {
    name: string;
    avatarUrl?: string;
    size?: number;
    fontSize?: number;
    isLocal?: boolean;
}

export const InitialsAvatar: React.FC<InitialsAvatarProps> = ({
    name,
    avatarUrl,
    size = 44,
    fontSize,
    isLocal = false,
}) => {
    const bgColor = getColorForName(name);
    const initials = getInitials(name);
    const computedFontSize = fontSize ?? Math.round(size * 0.36);

    const renderBadge = () => {
        if (!isLocal) return null;
        const badgeSize = size * 0.35;
        return (
            <View style={[
                styles.localBadge,
                {
                    width: badgeSize,
                    height: badgeSize,
                    borderRadius: badgeSize / 2,
                    bottom: -2,
                    right: -2,
                    borderColor: '#FFFFFF', // Use white border for the cut-out effect
                }
            ]}>
                <Star size={badgeSize * 0.65} color="#FFFFFF" fill="#FFFFFF" />
            </View>
        );
    };

    if (avatarUrl) {
        return (
            <View style={styles.container}>
                <Image
                    source={{ uri: avatarUrl }}
                    style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
                />
                {renderBadge()}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={[
                styles.base,
                { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }
            ]}>
                <Text style={[styles.initials, { fontSize: computedFontSize }]}>
                    {initials}
                </Text>
            </View>
            {renderBadge()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    base: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    initials: {
        color: '#FFFFFF',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    localBadge: {
        position: 'absolute',
        backgroundColor: '#F59E0B', // Amber 500 for the star background
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
});
