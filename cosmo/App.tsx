import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from './src/store/authStore';
import { Colors } from './src/constants/theme';
import SplashScreenNative from './src/components/SplashScreenNative';
import { useEventsStore } from './src/store/eventsStore';
import { useSwipeStore } from './src/store/swipeStore';

import LoginScreen from './src/screens/auth/LoginScreen';
import TermsOfServiceScreen from './src/screens/auth/TermsOfServiceScreen';
import PrivacyPolicyScreen from './src/screens/auth/PrivacyPolicyScreen';
import BasicInfoScreen from './src/screens/onboarding/BasicInfoScreen';
import InterestsScreen from './src/screens/onboarding/InterestsScreen';
import SubscriptionScreen from './src/screens/onboarding/SubscriptionScreen';
import PhotoUploadScreen from './src/screens/onboarding/PhotoUploadScreen';
import LocationScreen from './src/screens/onboarding/LocationScreen';
import CameraVerificationScreen from './src/screens/onboarding/CameraVerificationScreen';
import SwipeScreen from './src/screens/swipe/SwipeScreen';
import EventsScreen from './src/screens/events/EventsScreen';
import EventChatScreen from './src/screens/events/EventChatScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const OnboardingStack = createStackNavigator();

function MainTabs() {
  const pendingCount = useEventsStore((state) => state.pendingCount);
  const fetchAssignments = useEventsStore((state) => state.fetchAssignments);
  const incomingLikes = useSwipeStore((state) => state.incomingLikes);
  const fetchLikeStats = useSwipeStore((state) => state.fetchLikeStats);
  const hasFetchedRef = React.useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAssignments({ silent: true }).catch((error) => {
        console.error('[MainTabs] Failed to prefetch assignments:', error);
      });
    }
  }, [fetchAssignments]);

  useEffect(() => {
    fetchLikeStats().catch((error) => {
      console.error('[MainTabs] Failed to fetch like stats:', error);
    });
    const interval = setInterval(() => {
      fetchLikeStats().catch((error) => {
        console.error('[MainTabs] Failed to refresh like stats:', error);
      });
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchLikeStats]);

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
      <Tab.Screen
        name="Swipe"
        component={SwipeScreen}
        options={{
          tabBarBadge: incomingLikes > 0 ? incomingLikes : undefined,
          tabBarBadgeStyle:
            incomingLikes > 0
              ? {
                  backgroundColor: Colors.error,
                  color: Colors.white,
                  fontSize: 11,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                }
              : undefined,
        }}
      />
      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.error,
            color: Colors.white,
            fontSize: 11,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
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
      <OnboardingStack.Screen name="Subscription" component={SubscriptionScreen} />
      <OnboardingStack.Screen name="MainTabs" component={MainTabs} />
    </OnboardingStack.Navigator>
  );
}

const MIN_SPLASH_DURATION = 1500;

export default function App() {
  const { isAuthenticated, checkAuth, user } = useAuthStore();
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        await checkAuth();
      } finally {
        if (isMounted) {
          setIsAuthCheckComplete(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [checkAuth]);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (!isAuthCheckComplete || !minSplashElapsed) {
    return <SplashScreenNative />;
  }

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

  const isProfileComplete = hasPhotos && hasLocation && hasBasicProfile && hasInterests;

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
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EventChat"
              component={EventChatScreen}
              options={{ headerShown: true, title: 'Event Chat' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
