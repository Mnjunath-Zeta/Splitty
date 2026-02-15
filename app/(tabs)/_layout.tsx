import { Tabs } from 'expo-router';
import { LightColors, DarkColors } from '../../constants/Colors';
import { Home, Users, LayoutGrid, Settings } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useSplittyStore } from '../../store/useSplittyStore';

export default function TabsLayout() {
    const { isDarkMode } = useSplittyStore();
    const colors = isDarkMode ? DarkColors : LightColors;

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    height: Platform.OS === 'ios' ? 88 : 64,
                    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
                },
                headerStyle: {
                    backgroundColor: colors.background,
                },
                headerTitleStyle: {
                    color: colors.text,
                    fontWeight: 'bold',
                },
                headerShadowVisible: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="friends"
                options={{
                    title: 'Friends',
                    tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="groups"
                options={{
                    title: 'Groups',
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
