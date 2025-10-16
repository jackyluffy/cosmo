import { ImageAnnotatorClient } from '@google-cloud/vision';
import fs from 'fs';
import path from 'path';

type VisionClientOptions = ConstructorParameters<typeof ImageAnnotatorClient>[0];

let cachedClient: ImageAnnotatorClient | null = null;

type ServiceAccountCredentials = {
  project_id?: string;
  [key: string]: any;
};

function ensureTempCredentialsFile(credentialsJson: string): string {
  const tempDir = process.env.VISION_KEY_TMP_DIR || '/tmp';
  const filePath = path.join(tempDir, `vision-key-${Date.now()}.json`);
  fs.writeFileSync(filePath, credentialsJson, { encoding: 'utf8', mode: 0o600 });
  return filePath;
}

function loadCredentialsFromBase64(base64: string): VisionClientOptions {
  const json = Buffer.from(base64, 'base64').toString('utf8');
  const credentials = JSON.parse(json) as ServiceAccountCredentials;
  if (!credentials.project_id) {
    throw new Error('Decoded Vision credentials are missing project_id');
  }

  if (credentials.client_email) {
    console.log('[Vision Client] Using service account:', credentials.client_email);
  }

  const keyFile = ensureTempCredentialsFile(json);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFile;

  return {
    credentials,
    projectId: credentials.project_id,
  };
}

function loadCredentialsFromJson(json: string): VisionClientOptions {
  const credentials = JSON.parse(json) as ServiceAccountCredentials;
  if (!credentials.project_id) {
    throw new Error('Vision credentials JSON is missing project_id');
  }

  if (credentials.client_email) {
    console.log('[Vision Client] Using service account:', credentials.client_email);
  }

  const keyFile = ensureTempCredentialsFile(json);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFile;

  return {
    credentials,
    projectId: credentials.project_id,
  };
}

function loadCredentialsFromFile(filePath: string): VisionClientOptions {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Vision credentials file not found at path: ${filePath}`);
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  return loadCredentialsFromJson(fileContents);
}

export function getVisionClient(): ImageAnnotatorClient {
  if (cachedClient) {
    return cachedClient;
  }

  const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  const jsonCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const credentialsFileFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let clientOptions: VisionClientOptions | undefined;

  try {
    if (base64Credentials) {
      clientOptions = loadCredentialsFromBase64(base64Credentials);
      console.log('[Vision Client] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS_BASE64');
    } else if (jsonCredentials) {
      clientOptions = loadCredentialsFromJson(jsonCredentials);
      console.log('[Vision Client] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON');
    } else if (credentialsFileFromEnv) {
      clientOptions = loadCredentialsFromFile(credentialsFileFromEnv);
      console.log('[Vision Client] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS');
    } else {
      const defaultKeyPath = path.join(__dirname, '../../cosmo-firebase-key.json');
      if (fs.existsSync(defaultKeyPath)) {
        clientOptions = loadCredentialsFromFile(defaultKeyPath);
        console.log('[Vision Client] Loaded credentials from local cosmo-firebase-key.json');
      } else {
        console.warn('[Vision Client] No explicit credentials provided. Relying on default application credentials.');
      }
    }
  } catch (error: any) {
    console.error('[Vision Client] Failed to load credentials:', error.message);
    throw error;
  }

  cachedClient = clientOptions
    ? new ImageAnnotatorClient(clientOptions)
    : new ImageAnnotatorClient();

  return cachedClient;
}
