import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from './src/store/authStore';
import { Colors } from './src/constants/theme';

import LoginScreen from './src/screens/auth/LoginScreen';
import TermsOfServiceScreen from './src/screens/auth/TermsOfServiceScreen';
import PrivacyPolicyScreen from './src/screens/auth/PrivacyPolicyScreen';
import BasicInfoScreen from './src/screens/onboarding/BasicInfoScreen';
import InterestsScreen from './src/screens/onboarding/InterestsScreen';
import PhotoUploadScreen from './src/screens/onboarding/PhotoUploadScreen';
import LocationScreen from './src/screens/onboarding/LocationScreen';
import CameraVerificationScreen from './src/screens/onboarding/CameraVerificationScreen';
import SwipeScreen from './src/screens/swipe/SwipeScreen';
import EventsScreen from './src/screens/events/EventsScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const OnboardingStack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Swipe') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Events') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Swipe" component={SwipeScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function OnboardingFlow() {
  const { loadUser } = useAuthStore();

  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="BasicInfo">
        {({ navigation }) => (
          <BasicInfoScreen onComplete={() => navigation.navigate('PhotoUpload')} />
        )}
      </OnboardingStack.Screen>
      <OnboardingStack.Screen name="PhotoUpload">
        {({ navigation }) => (
          <PhotoUploadScreen onComplete={() => navigation.navigate('Location')} />
        )}
      </OnboardingStack.Screen>
      <OnboardingStack.Screen name="Location" component={LocationScreen} />
      <OnboardingStack.Screen name="CameraVerification" component={CameraVerificationScreen} />
      <OnboardingStack.Screen name="Interests" component={InterestsScreen} />
    </OnboardingStack.Navigator>
  );
}

export default function App() {
  const { isAuthenticated, checkAuth, user } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  // Check onboarding status
  const hasPhotos = !!(user?.profile?.photos && user.profile.photos.length >= 3);
  // Check for location in multiple formats (GeoPoint: _latitude/_longitude, API: latitude/longitude, or lat/lng)
  const location = user?.profile?.location;
  const hasLocation = !!(
    (location?._latitude !== undefined && location?._longitude !== undefined) ||
    (location?.latitude !== undefined && location?.longitude !== undefined) ||
    (location?.lat !== undefined && location?.lng !== undefined)
  );
  const hasInterests = !!(user?.profile?.interests && user.profile.interests.length > 0);
  const hasBasicProfile = !!(user?.profile?.name && user?.profile?.age);
  const isVerified = !!(user?.profile?.verified);

  const isProfileComplete = hasPhotos && hasLocation && hasBasicProfile && hasInterests && isVerified;

  // Debug logging
  console.log('Profile completion check:', {
    hasPhotos,
    hasLocation,
    hasInterests,
    hasBasicProfile,
    isVerified,
    isProfileComplete,
    location: user?.profile?.location,
    user: user?.profile
  });

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Not authenticated - show login and legal screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
          </>
        ) : !isProfileComplete ? (
          // Authenticated but needs onboarding
          <Stack.Screen name="Onboarding" component={OnboardingFlow} />
        ) : (
          // Authenticated and profile complete - show main app
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
