import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Colors } from '../constants/Colors';
import { StatusBar } from 'expo-status-bar';
import { useSplittyStore } from '../store/useSplittyStore';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const { setSession, fetchData, subscribeToChanges, initNotifications } = useSplittyStore();
    const session = useSplittyStore(state => state.session);

    useEffect(() => {
        initNotifications();
        console.log('RootLayout: Initializing Auth...');

        // Recurring Expenses Check
        const count = useSplittyStore.getState().checkRecurringExpenses();
        if (count > 0) {
            Alert.alert('Recurring Expenses', `${count} new expense(s) have been added based on your schedule.`);
        }

        // Auth Initial Session
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('RootLayout: Session fetched', !!session);
            setSession(session);
            if (session) {
                fetchData();
                console.log('RootLayout: Redirecting to Tabs');
                router.replace('/(tabs)');
            } else {
                console.log('RootLayout: Redirecting to Auth');
                router.replace('/auth');
            }
        });

        // Auth Listener
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('RootLayout: Auth event', event, !!session);
            setSession(session);
            if (session) {
                fetchData();
                router.replace('/(tabs)');
            } else {
                router.replace('/auth');
            }
        });

        return () => authSubscription.unsubscribe();
    }, []);

    // Real-time Sync Subscription
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        if (session) {
            unsubscribe = subscribeToChanges();
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [session]);

    const appearance = useSplittyStore(state => state.appearance);
    const colors = useSplittyStore(state => state.colors);
    const isDark = appearance === 'dark';

    return (
        <>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack
                screenOptions={{
                    headerStyle: {
                        backgroundColor: colors.background,
                    },
                    headerTitleStyle: {
                        color: colors.text,
                        fontWeight: 'bold',
                    },
                    headerShadowVisible: false,
                    headerTintColor: colors.primary,
                }}
            >
                <Stack.Screen name="index" options={{ headerShown: false, title: '' }} />
                <Stack.Screen name="auth" options={{ headerShown: false, title: '' }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="add-expense"
                    options={{
                        presentation: 'modal',
                        headerShown: true
                    }}
                />
            </Stack>
        </>
    );
}
