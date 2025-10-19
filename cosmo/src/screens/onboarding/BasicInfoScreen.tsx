import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

interface BasicInfoScreenProps {
  onComplete: () => void;
}

type Gender = 'male' | 'female' | 'non-binary' | 'other';
type SocialPlatform = 'instagram' | 'wechat' | null;
type GenderPreference = 'male' | 'female' | 'both';
type Ethnicity = 'Asian' | 'Black' | 'Hispanic' | 'White' | 'Mixed' | 'Other';

export default function BasicInfoScreen({ onComplete }: BasicInfoScreenProps) {
  const { logout } = useAuthStore();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('5\'5"'); // Default to 5'5"
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [genderPreference, setGenderPreference] = useState<GenderPreference | null>(null);
  const [ethnicity, setEthnicity] = useState<Ethnicity | null>(null);
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>(null);
  const [socialHandle, setSocialHandle] = useState('');
  const [job, setJob] = useState('');
  const [oneThingAboutMe, setOneThingAboutMe] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const heightScrollViewRef = useRef<ScrollView>(null);

  const handleLogout = async () => {
    Alert.alert(
      'Start Over?',
      'This will log you out and you can sign in with a different number',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        },
      ]
    );
  };

  // Generate height options from 4'0" to 7'0"
  const heightOptions: string[] = [];
  for (let feet = 4; feet <= 7; feet++) {
    for (let inches = 0; inches < 12; inches++) {
      heightOptions.push(`${feet}'${inches}"`);
    }
  }

  const genderOptions: { value: Gender; label: string; icon: string }[] = [
    { value: 'male', label: 'Male', icon: 'male' },
    { value: 'female', label: 'Female', icon: 'female' },
    { value: 'non-binary', label: 'Non-binary', icon: 'transgender' },
    { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  const handleContinue = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name');
      return;
    }

    if (!age || parseInt(age) < 18 || parseInt(age) > 100) {
      Alert.alert('Invalid Age', 'Please enter your age (18-100)');
      return;
    }

    if (!gender) {
      Alert.alert('Gender Required', 'Please select your gender');
      return;
    }

    if (!genderPreference) {
      Alert.alert('Preference Required', 'Please select who you want to meet');
      return;
    }

    if (!ethnicity) {
      Alert.alert('Ethnicity Required', 'Please select your ethnicity');
      return;
    }

    if (!height) {
      Alert.alert('Height Required', 'Please select your height');
      return;
    }

    if (!oneThingAboutMe.trim()) {
      Alert.alert('Required Field', 'Please tell us one thing you want people to know about you');
      return;
    }

    if (socialPlatform && !socialHandle.trim()) {
      Alert.alert('Social Handle Required', `Please enter your ${socialPlatform} handle`);
      return;
    }

    setIsLoading(true);
    try {
      const { updateProfile } = useAuthStore.getState();

      const profileData: any = {
        name: name.trim(),
        age: parseInt(age),
        height: height,
        gender,
        genderPreference,
        ethnicity,
        bio: oneThingAboutMe.trim(),
      };

      // Add optional job field if provided
      if (job.trim()) {
        profileData.occupation = job.trim();
      }

      // Add optional lookingFor field if provided
      if (lookingFor.trim()) {
        profileData.lookingFor = lookingFor.trim();
      }

      // Add social media handle if provided
      if (socialPlatform && socialHandle.trim()) {
        profileData.socialMedia = {
          platform: socialPlatform,
          handle: socialHandle.trim(),
        };
      }

      await updateProfile(profileData);
      onComplete();
    } catch (error: any) {
      console.error('Basic info update error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save information');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color={Colors.gray} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Tell us about yourself</Text>
          <Text style={styles.subtitle}>
            Let's start with the basics
          </Text>
        </View>

        {/* Name Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={Colors.gray}
            autoCapitalize="words"
            maxLength={50}
          />
        </View>

        {/* Age Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Age *</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="Enter your age"
            placeholderTextColor={Colors.gray}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        {/* Height Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Height *</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              const newState = !showHeightPicker;
              setShowHeightPicker(newState);

              // Scroll to default height (5'5") when opening picker
              if (newState) {
                setTimeout(() => {
                  const defaultIndex = heightOptions.indexOf('5\'5"');
                  if (defaultIndex >= 0 && heightScrollViewRef.current) {
                    // Calculate approximate scroll position (48px per item)
                    const scrollY = defaultIndex * 48;
                    heightScrollViewRef.current.scrollTo({ y: scrollY, animated: true });
                  }
                }, 100);
              }
            }}
          >
            <Text style={{ color: height ? Colors.text : Colors.gray }}>
              {height || "Select your height"}
            </Text>
            <Ionicons
              name={showHeightPicker ? "chevron-up" : "chevron-down"}
              size={20}
              color={Colors.gray}
              style={{ position: 'absolute', right: 16, top: 16 }}
            />
          </TouchableOpacity>

          {showHeightPicker && (
            <View style={styles.heightPickerContainer}>
              <ScrollView
                ref={heightScrollViewRef}
                style={styles.heightScrollView}
                showsVerticalScrollIndicator={true}
              >
                {heightOptions.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.heightOption,
                      height === h && styles.heightOptionSelected
                    ]}
                    onPress={() => {
                      setHeight(h);
                      setShowHeightPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.heightOptionText,
                      height === h && styles.heightOptionTextSelected
                    ]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Gender Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gender *</Text>
          <View style={styles.genderGrid}>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderButton,
                  gender === option.value && styles.genderButtonSelected,
                ]}
                onPress={() => setGender(option.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={gender === option.value ? Colors.primary : Colors.gray}
                />
                <Text
                  style={[
                    styles.genderLabel,
                    gender === option.value && styles.genderLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Gender Preference Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>I want to meet *</Text>
          <View style={styles.genderGrid}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                genderPreference === 'male' && styles.genderButtonSelected,
              ]}
              onPress={() => setGenderPreference('male')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="male"
                size={24}
                color={genderPreference === 'male' ? Colors.primary : Colors.gray}
              />
              <Text
                style={[
                  styles.genderLabel,
                  genderPreference === 'male' && styles.genderLabelSelected,
                ]}
              >
                Man Only
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                genderPreference === 'female' && styles.genderButtonSelected,
              ]}
              onPress={() => setGenderPreference('female')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="female"
                size={24}
                color={genderPreference === 'female' ? Colors.primary : Colors.gray}
              />
              <Text
                style={[
                  styles.genderLabel,
                  genderPreference === 'female' && styles.genderLabelSelected,
                ]}
              >
                Woman Only
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                genderPreference === 'both' && styles.genderButtonSelected,
              ]}
              onPress={() => setGenderPreference('both')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="people"
                size={24}
                color={genderPreference === 'both' ? Colors.primary : Colors.gray}
              />
              <Text
                style={[
                  styles.genderLabel,
                  genderPreference === 'both' && styles.genderLabelSelected,
                ]}
              >
                Both
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ethnicity Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ethnicity *</Text>
          <View style={styles.genderGrid}>
            {(['Asian', 'Black', 'Hispanic', 'White', 'Mixed', 'Other'] as Ethnicity[]).map((eth) => (
              <TouchableOpacity
                key={eth}
                style={[
                  styles.genderButton,
                  ethnicity === eth && styles.genderButtonSelected,
                ]}
                onPress={() => setEthnicity(eth)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.genderLabel,
                    ethnicity === eth && styles.genderLabelSelected,
                  ]}
                >
                  {eth}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Job Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Job / Occupation (Optional)</Text>
          <TextInput
            style={styles.input}
            value={job}
            onChangeText={setJob}
            placeholder="e.g., Software Engineer, Teacher, etc."
            placeholderTextColor={Colors.gray}
            autoCapitalize="words"
            maxLength={50}
          />
        </View>

        {/* Social Media */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Social Media (Optional)</Text>
          <View style={styles.socialPlatformRow}>
            <TouchableOpacity
              style={[
                styles.platformButton,
                socialPlatform === 'instagram' && styles.platformButtonSelected,
              ]}
              onPress={() => setSocialPlatform(socialPlatform === 'instagram' ? null : 'instagram')}
            >
              <Ionicons
                name="logo-instagram"
                size={24}
                color={socialPlatform === 'instagram' ? Colors.primary : Colors.gray}
              />
              <Text
                style={[
                  styles.platformLabel,
                  socialPlatform === 'instagram' && styles.platformLabelSelected,
                ]}
              >
                Instagram
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.platformButton,
                socialPlatform === 'wechat' && styles.platformButtonSelected,
              ]}
              onPress={() => setSocialPlatform(socialPlatform === 'wechat' ? null : 'wechat')}
            >
              <Ionicons
                name="chatbubbles"
                size={24}
                color={socialPlatform === 'wechat' ? Colors.primary : Colors.gray}
              />
              <Text
                style={[
                  styles.platformLabel,
                  socialPlatform === 'wechat' && styles.platformLabelSelected,
                ]}
              >
                WeChat
              </Text>
            </TouchableOpacity>
          </View>

          {socialPlatform && (
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              value={socialHandle}
              onChangeText={setSocialHandle}
              placeholder={`Enter your ${socialPlatform} handle`}
              placeholderTextColor={Colors.gray}
              autoCapitalize="none"
              maxLength={50}
            />
          )}
        </View>

        {/* One Thing About Me */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>One thing I want you to know about me *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={oneThingAboutMe}
            onChangeText={setOneThingAboutMe}
            placeholder="Share something unique about yourself..."
            placeholderTextColor={Colors.gray}
            multiline
            numberOfLines={4}
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{oneThingAboutMe.length}/200</Text>
        </View>

        {/* What I'm Looking For */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>What I'm looking for in a dating partner (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={lookingFor}
            onChangeText={setLookingFor}
            placeholder="What qualities are you looking for..."
            placeholderTextColor={Colors.gray}
            multiline
            numberOfLines={4}
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{lookingFor.length}/200</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!name || !age || !height || !gender || !genderPreference || !ethnicity || !oneThingAboutMe) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!name || !age || !height || !gender || !genderPreference || !ethnicity || !oneThingAboutMe || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoutButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  header: {
    marginBottom: 30,
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
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  inputWithIcon: {
    marginTop: 12,
  },
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.gray,
    textAlign: 'right',
    marginTop: 4,
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  genderButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
    gap: 12,
  },
  genderButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  genderLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  genderLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  socialPlatformRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  platformButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
    gap: 8,
  },
  platformButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  platformLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  platformLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  continueButtonDisabled: {
    backgroundColor: Colors.lightGray,
  },
  continueButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  heightPickerContainer: {
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    maxHeight: 200,
    overflow: 'hidden',
  },
  heightScrollView: {
    maxHeight: 200,
  },
  heightOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  heightOptionSelected: {
    backgroundColor: Colors.primary + '10',
  },
  heightOptionText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },
  heightOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
