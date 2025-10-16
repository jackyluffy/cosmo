"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVisionClient = getVisionClient;
const vision_1 = require("@google-cloud/vision");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let cachedClient = null;
function ensureTempCredentialsFile(credentialsJson) {
    const tempDir = process.env.VISION_KEY_TMP_DIR || '/tmp';
    const filePath = path_1.default.join(tempDir, `vision-key-${Date.now()}.json`);
    fs_1.default.writeFileSync(filePath, credentialsJson, { encoding: 'utf8', mode: 0o600 });
    return filePath;
}
function loadCredentialsFromBase64(base64) {
    const json = Buffer.from(base64, 'base64').toString('utf8');
    const credentials = JSON.parse(json);
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
function loadCredentialsFromJson(json) {
    const credentials = JSON.parse(json);
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
function loadCredentialsFromFile(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`Vision credentials file not found at path: ${filePath}`);
    }
    const fileContents = fs_1.default.readFileSync(filePath, 'utf8');
    return loadCredentialsFromJson(fileContents);
}
function getVisionClient() {
    if (cachedClient) {
        return cachedClient;
    }
    const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
    const jsonCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const credentialsFileFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let clientOptions;
    try {
        if (base64Credentials) {
            clientOptions = loadCredentialsFromBase64(base64Credentials);
            console.log('[Vision Client] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS_BASE64');
        }
        else if (jsonCredentials) {
            clientOptions = loadCredentialsFromJson(jsonCredentials);
            console.log('[Vision Client] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON');
        }
        else if (credentialsFileFromEnv) {
            clientOptions = loadCredentialsFromFile(credentialsFileFromEnv);
            console.log('[Vision Client] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS');
        }
        else {
            const defaultKeyPath = path_1.default.join(__dirname, '../../cosmo-firebase-key.json');
            if (fs_1.default.existsSync(defaultKeyPath)) {
                clientOptions = loadCredentialsFromFile(defaultKeyPath);
                console.log('[Vision Client] Loaded credentials from local cosmo-firebase-key.json');
            }
            else {
                console.warn('[Vision Client] No explicit credentials provided. Relying on default application credentials.');
            }
        }
    }
    catch (error) {
        console.error('[Vision Client] Failed to load credentials:', error.message);
        throw error;
    }
    cachedClient = clientOptions
        ? new vision_1.ImageAnnotatorClient(clientOptions)
        : new vision_1.ImageAnnotatorClient();
    return cachedClient;
}
//# sourceMappingURL=visionClient.js.map