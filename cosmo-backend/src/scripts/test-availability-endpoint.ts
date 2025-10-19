import axios from 'axios';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gMJhRKGurkCm3s2HhasQ4kKFEc+0f/L+8pYNA1K56oHIeAKhHtyHbsiRi39tXvzBVeSk8HxTxiNw0S7aPlbGhA==';
const API_URL = 'https://cosmo-api-691853413697.us-west1.run.app';
const USER_ID = 'bHzCB8AYCoHhj5N56aAG'; // Jason's ID

async function testAvailabilityEndpoint() {
  try {
    // Generate a JWT token for the user
    const token = jwt.sign(
      { userId: USER_ID },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('🔑 Generated JWT token for user:', USER_ID);
    console.log('');

    // Test data
    const availabilityData = {
      availability: {
        '2025-10-18': {
          morning: true,
          afternoon: true,
          evening: false,
          night: false,
          blocked: false,
        },
        '2025-10-19': {
          morning: false,
          afternoon: true,
          evening: true,
          night: true,
          blocked: false,
        },
        '2025-10-20': {
          morning: true,
          afternoon: false,
          evening: true,
          night: false,
          blocked: false,
        },
      },
    };

    console.log('📤 Sending availability data:');
    console.log(JSON.stringify(availabilityData, null, 2));
    console.log('');

    // Update profile with availability
    const updateResponse = await axios.put(
      `${API_URL}/api/v1/profile`,
      availabilityData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Update response status:', updateResponse.status);
    console.log('Response data:', JSON.stringify(updateResponse.data, null, 2));
    console.log('');

    // Get profile to verify
    console.log('📥 Fetching profile to verify...');
    const getResponse = await axios.get(
      `${API_URL}/api/v1/profile/me`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    console.log('Profile availability:');
    if (getResponse.data?.profile?.availability) {
      console.log(JSON.stringify(getResponse.data.profile.availability, null, 2));
      console.log('');
      console.log('✅ SUCCESS! Availability data is saved in Firebase!');
    } else {
      console.log('⚠️  No availability data found in profile');
      console.log('Full profile:', JSON.stringify(getResponse.data, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testAvailabilityEndpoint()
  .then(() => {
    console.log('\n✓ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
