import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  InteractionManager,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

interface LocationScreenProps {
  navigation: any;
}

// DEV: Set to true to use Placentia, CA location for testing
const USE_TEST_LOCATION = false;
const TEST_LOCATION = {
  latitude: 33.8722,
  longitude: -117.8703,
}; // Placentia, CA

export default function LocationScreen({ navigation }: LocationScreenProps) {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [radius, setRadius] = useState(25); // Default 25 miles
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<MapView>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (USE_TEST_LOCATION) {
      setLocation(TEST_LOCATION);
    } else {
      requestLocationPermission();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (mapRef.current) {
        mapRef.current = null;
      }
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        getCurrentLocation();
      } else {
        Alert.alert(
          'Location Permission',
          'Location permission is needed to show nearby people',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: requestLocationPermission },
          ]
        );
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get current location');
      // Set default location (San Francisco)
      setLocation({
        latitude: 37.7749,
        longitude: -122.4194,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
  };

  const handleContinue = async () => {
    if (!location) {
      Alert.alert('Location Required', 'Please select your location on the map');
      return;
    }

    // Prevent double-clicks
    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      const { updateProfile, loadUser } = useAuthStore.getState();

      const profileUpdate = {
        location: {
          lat: location.latitude,
          lng: location.longitude,
        },
        radius: radius,
      };

      console.log('[LocationScreen] Updating profile with location:', profileUpdate);

      // Update profile - DON'T call loadUser() to avoid App.tsx re-render race condition
      await updateProfile(profileUpdate);

      console.log('[LocationScreen] Profile updated, navigating...');

      // Use InteractionManager to ensure all interactions are complete before navigating
      // This allows MapView to finish any pending operations before unmounting
      InteractionManager.runAfterInteractions(() => {
        if (isMountedRef.current) {
          navigation.navigate('CameraVerification');
        }
      });
    } catch (error: any) {
      console.error('[LocationScreen] Location update error:', error);

      // Only update state if still mounted
      if (isMountedRef.current) {
        setIsLoading(false);
        Alert.alert(
          'Error',
          error.response?.data?.error || error.message || 'Failed to update location. Please try again.'
        );
      }
    }
  };

  const milesToMeters = (miles: number) => miles * 1609.34;

  if (isLoading && !location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Set Your Location</Text>
        <Text style={styles.subtitle}>
          Tap the map or drag the marker to set your location
        </Text>
      </View>

      <View style={styles.mapContainer}>
        {location && (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            }}
            onPress={handleMapPress}
          >
            <Marker
              coordinate={location}
              draggable
              onDragEnd={(e) => setLocation(e.nativeEvent.coordinate)}
            >
              <View style={styles.markerContainer}>
                <Ionicons name="person" size={24} color={Colors.primary} />
              </View>
            </Marker>
          </MapView>
        )}

        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={getCurrentLocation}
        >
          <Ionicons name="locate" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View style={styles.radiusContainer}>
          <Text style={styles.radiusLabel}>Search Radius</Text>
          <Text style={styles.radiusValue}>{radius} miles</Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={100}
          step={1}
          value={radius}
          onValueChange={setRadius}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.lightGray}
          thumbTintColor={Colors.primary}
        />

        <Text style={styles.radiusHint}>
          You'll see people within {radius} miles of your location
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.continueButton, !location && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={!location || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.continueButtonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.gray,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  controls: {
    padding: 20,
  },
  radiusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  radiusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  radiusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  radiusHint: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: Colors.lightGray,
  },
  continueButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
