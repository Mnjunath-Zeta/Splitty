import { ComponentType } from 'react';
import {
    Utensils,
    Bus,
    Home,
    Clapperboard,
    ShoppingCart,
    HeartPulse,
    Plane,
    Wifi,
    MoreHorizontal,
    GraduationCap,
    Gift,
    Car
} from 'lucide-react-native';

export type CategoryKey =
    | 'food'
    | 'transport'
    | 'housing'
    | 'entertainment'
    | 'shopping'
    | 'health'
    | 'travel'
    | 'utilities'
    | 'education'
    | 'gifts'
    | 'general';

export interface Category {
    id: CategoryKey;
    label: string;
    icon: ComponentType<any>;
    color: string;
}

export const CATEGORIES: Category[] = [
    { id: 'general', label: 'General', icon: MoreHorizontal, color: '#64748B' }, // Slate 500
    { id: 'food', label: 'Food & Drink', icon: Utensils, color: '#EF4444' }, // Red 500
    { id: 'transport', label: 'Transport', icon: Bus, color: '#F59E0B' }, // Amber 500
    { id: 'housing', label: 'Housing', icon: Home, color: '#3B82F6' }, // Blue 500
    { id: 'utilities', label: 'Utilities', icon: Wifi, color: '#06B6D4' }, // Cyan 500
    { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#8B5CF6' }, // Violet 500
    { id: 'shopping', label: 'Shopping', icon: ShoppingCart, color: '#EC4899' }, // Pink 500
    { id: 'health', label: 'Health', icon: HeartPulse, color: '#10B981' }, // Emerald 500
    { id: 'travel', label: 'Travel', icon: Plane, color: '#F43F5E' }, // Rose 500
    { id: 'education', label: 'Education', icon: GraduationCap, color: '#6366F1' }, // Indigo 500
    { id: 'gifts', label: 'Gifts', icon: Gift, color: '#D946EF' }, // Fuchsia 500
];

export const getCategoryById = (id: string): Category => {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
};
