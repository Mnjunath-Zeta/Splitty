import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { Themes, ThemeName, Colors } from '../constants/Colors';
import { useSplittyStore } from '../store/useSplittyStore';
import { StyledInput } from '../components/StyledInput';
import { VibrantButton } from '../components/VibrantButton';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
    const router = useRouter();
    const { appearance, colors } = useSplittyStore();
    const isDark = appearance === 'dark';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            const isWeb = Platform.OS === 'web';
            const redirectUri = isWeb
                ? window.location.origin
                : Linking.createURL('/');

            console.log('Redirect URI:', redirectUri);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUri,
                    skipBrowserRedirect: !isWeb,
                },
            });

            if (error) throw error;

            if (!isWeb && data.url) {
                const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

                if (res.type === 'success' && res.url) {
                    const part = res.url.split('#')[1];
                    if (part) {
                        const params = Object.fromEntries(
                            part.split('&').map(p => p.split('='))
                        );

                        const { access_token, refresh_token } = params;

                        if (access_token && refresh_token) {
                            const { error: sessionError } = await supabase.auth.setSession({
                                access_token,
                                refresh_token,
                            });
                            if (sessionError) throw sessionError;
                        }
                    }
                }
            }
        } catch (error: any) {
            Alert.alert('Google Sign In Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async () => {
        setLoading(true);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                Alert.alert('Sign Up Successful', 'Please check your email for verification link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.text }]}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>

                <StyledInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    placeholder="Enter your email"
                />

                <StyledInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Enter your password"
                />

                <VibrantButton
                    title={loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    onPress={handleAuth}
                    disabled={loading}
                    style={styles.button}
                />

                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleButton}>
                    <Text style={{ color: colors.primary }}>
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={[styles.line, { backgroundColor: colors.border }]} />
                    <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
                    <View style={[styles.line, { backgroundColor: colors.border }]} />
                </View>

                <VibrantButton
                    title="Continue with Google"
                    onPress={handleGoogleSignIn}
                    variant="outline"
                    disabled={loading}
                    style={styles.googleButton}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    content: {
        padding: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 32,
        textAlign: 'center',
    },
    button: {
        marginTop: 16,
    },
    toggleButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 32,
    },
    line: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: 16,
        fontSize: 14,
        fontWeight: '600',
    },
    googleButton: {
        marginTop: 0,
    },
});
