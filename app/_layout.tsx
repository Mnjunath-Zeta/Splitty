import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Colors } from '../constants/Colors';
import { useSplittyStore } from '../store/useSplittyStore';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const { setSession, fetchData, subscribeToChanges } = useSplittyStore();
    const session = useSplittyStore(state => state.session);

    useEffect(() => {
        // Recurring Expenses Check
        const count = useSplittyStore.getState().checkRecurringExpenses();
        if (count > 0) {
            Alert.alert('Recurring Expenses', `${count} new expense(s) have been added based on your schedule.`);
        }

        // Auth Initial Session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                fetchData();
            }
        });

        // Auth Listener
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: Colors.background,
                },
                headerTitleStyle: {
                    color: Colors.text,
                    fontWeight: 'bold',
                },
                headerShadowVisible: false,
                headerTintColor: Colors.primary,
            }}
        >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
                name="add-expense"
                options={{
                    presentation: 'modal',
                    headerShown: true
                }}
            />
        </Stack>
    );
}
