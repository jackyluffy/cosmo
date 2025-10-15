import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from '@invertase/react-native-apple-authentication';
import { useAuthStore } from '../../store/authStore';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';

// Configure Google Sign-In globally
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '691853413697-d3r6po74rsm6ak7vdfk51a764lnk9udv.apps.googleusercontent.com',
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '691853413697-9keo426hbtj6e469cravkt04dtq5b07t.apps.googleusercontent.com',
  offlineAccess: false,
  scopes: ['profile', 'email'],
});

export default function LoginScreen({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);

  const { login, googleSignIn, isLoading, error } = useAuthStore();

  const handleSendOtp = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    try {
      // Format phone number with +1 if not already formatted
      let formattedPhone = phoneNumber;
      if (!phoneNumber.startsWith('+')) {
        formattedPhone = '+1' + phoneNumber.replace(/\D/g, '');
      }

      await login(formattedPhone, undefined);
      setShowOtpInput(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    try {
      // Format phone number with +1 if not already formatted
      let formattedPhone = phoneNumber;
      if (!phoneNumber.startsWith('+')) {
        formattedPhone = '+1' + phoneNumber.replace(/\D/g, '');
      }

      await login(formattedPhone, undefined, otpCode);
      console.log('Login successful - navigation should happen automatically');
      // Navigation will happen automatically based on auth state in App.tsx
      // DO NOT navigate manually here
    } catch (error) {
      Alert.alert('Error', 'Invalid code. Please try again.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      console.log('Starting Apple Sign-In...');

      const appleAuthRequestResponse = await AppleAuthentication.appleAuth.performRequest({
        requestedOperation: AppleAuthentication.appleAuth.Operation.LOGIN,
        requestedScopes: [
          AppleAuthentication.appleAuth.Scope.EMAIL,
          AppleAuthentication.appleAuth.Scope.FULL_NAME,
        ],
      });

      const { identityToken, user } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }

      console.log('Apple Sign-In successful, sending to backend...');
      // TODO: Send identityToken to your backend
      await googleSignIn(identityToken); // Reuse the same backend endpoint or create appleSignIn
      // Navigation will happen automatically based on auth state
    } catch (error: any) {
      console.error('Apple Sign-In error:', error);
      if (error.code !== AppleAuthentication.appleAuth.Error.CANCELED) {
        Alert.alert('Error', error.message || 'Apple Sign-In failed');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      console.log('Starting Google Sign-In...');
      console.log('iOS Client ID:', process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
      console.log('Web Client ID:', process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);

      // hasPlayServices is only for Android
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }

      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In response:', JSON.stringify(userInfo, null, 2));

      // Check if user cancelled
      if (userInfo.type === 'cancelled') {
        console.log('User cancelled Google Sign-In');
        return;
      }

      // Get the ID token - try both possible locations
      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        console.error('No ID token in response. Full response:', userInfo);
        throw new Error('No ID token received from Google');
      }

      console.log('Google Sign-In successful, sending to backend...');
      await googleSignIn(idToken);
      // Navigation will happen automatically based on auth state
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Error', error.message || 'Google Sign-In failed');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.topSection}>
          <View style={styles.header}>
            <Text style={styles.appName}>Cosmo</Text>
            <Text style={styles.subtitle}>
              Do fun things with your date
            </Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.bottomSection}>
          {!showOtpInput ? (
            <>
              {/* Phone number authentication - commented out
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor={Colors.gray}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
              />

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Send Code</Text>
                )}
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
              */}

              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={[styles.socialButtonText, { color: Colors.white }]}>
                    Continue with Apple
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton]}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.text} />
                ) : (
                  <Text style={[styles.socialButtonText, { color: Colors.text }]}>
                    Continue with Google
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  By continuing, you agree to our{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => navigation.navigate('TermsOfService')}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => navigation.navigate('PrivacyPolicy')}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.otpTitle}>Enter verification code</Text>
              <Text style={styles.otpSubtitle}>
                We sent a 6-digit code to {phoneNumber}
              </Text>

              <TextInput
                style={styles.otpInput}
                placeholder="123456"
                placeholderTextColor={Colors.gray}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <Text style={styles.testHint}>💡 Hint: Enter any 6 digits like 123456</Text>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowOtpInput(false);
                  setOtpCode('');
                }}
              >
                <Text style={styles.backText}>← Back to login</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  topSection: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  bottomSection: {
    flex: 2,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1B2B4D',
    letterSpacing: 2,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  authMethodContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  methodButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: Colors.primary100,
    borderColor: Colors.primary,
  },
  methodButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  methodButtonTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  button: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
  otpTitle: {
    ...Typography.h3,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  otpSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  otpInput: {
    height: 64,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backText: {
    ...Typography.body,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  testNotice: {
    backgroundColor: Colors.primary100,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  testNoticeText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  testNoticeSubtext: {
    ...Typography.caption,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  testHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  socialButton: {
    height: 56,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DADCE0',
  },
  socialButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.md,
  },
  termsContainer: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  termsText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});