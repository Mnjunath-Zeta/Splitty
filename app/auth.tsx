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

    const [phone, setPhone] = useState('');
    const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
    const [verificationCode, setVerificationCode] = useState('');
    const [showVerification, setShowVerification] = useState(false);

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

    const handlePhoneSignIn = async () => {
        setLoading(true);
        try {
            // Basic validation
            if (!phone || phone.length < 10) {
                throw new Error('Please enter a valid phone number');
            }

            // Ensure E.164 format if possible, or assume country code if user provides it.
            // For simplicity, let's assume user enters full number or we default to a region if implementing robustly.
            // Here we just pass it to supabase.

            const { error } = await supabase.auth.signInWithOtp({
                phone: phone,
            });
            if (error) throw error;
            setShowVerification(true);
            Alert.alert('OTP Sent', 'Please check your phone for verification code.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                phone: phone,
                token: verificationCode,
                type: 'sms',
            });
            if (error) throw error;
            // Success - session will auto-update
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async () => {
        if (authMethod === 'phone') {
            if (showVerification) {
                await verifyOtp();
            } else {
                await handlePhoneSignIn();
            }
            return;
        }

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
                <Text style={[styles.title, { color: colors.text }]}>
                    {authMethod === 'phone'
                        ? (showVerification ? 'Verify Phone' : 'Phone Sign In')
                        : (isSignUp ? 'Create Account' : 'Welcome Back')}
                </Text>

                <View style={styles.methodToggle}>
                    <TouchableOpacity
                        style={[styles.methodBtn, authMethod === 'email' && { backgroundColor: colors.primary }]}
                        onPress={() => { setAuthMethod('email'); setShowVerification(false); }}
                    >
                        <Text style={{ color: authMethod === 'email' ? 'white' : colors.text }}>Email</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.methodBtn, authMethod === 'phone' && { backgroundColor: colors.primary }]}
                        onPress={() => { setAuthMethod('phone'); setShowVerification(false); }}
                    >
                        <Text style={{ color: authMethod === 'phone' ? 'white' : colors.text }}>Phone</Text>
                    </TouchableOpacity>
                </View>

                {authMethod === 'email' ? (
                    <>
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
                    </>
                ) : (
                    <>
                        {!showVerification ? (
                            <StyledInput
                                label="Phone Number"
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="+1234567890"
                                keyboardType="phone-pad"
                            />
                        ) : (
                            <StyledInput
                                label="Verification Code"
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                placeholder="123456"
                                keyboardType="number-pad"
                            />
                        )}
                    </>
                )}

                <VibrantButton
                    title={loading ? 'Please wait...' : (authMethod === 'phone' ? (showVerification ? 'Verify' : 'Send Code') : (isSignUp ? 'Sign Up' : 'Sign In'))}
                    onPress={handleAuth}
                    disabled={loading}
                    style={styles.button}
                />

                {authMethod === 'email' && (
                    <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleButton}>
                        <Text style={{ color: colors.primary }}>
                            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </Text>
                    </TouchableOpacity>
                )}

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
    methodToggle: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: 'rgba(150,150,150,0.1)',
        padding: 4,
        borderRadius: 12,
    },
    methodBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
});
