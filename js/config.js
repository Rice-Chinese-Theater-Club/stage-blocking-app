// config.js - Configuration Constants
// Online Blocking Notes

// Debug mode - set to false in production
export const DEBUG_MODE = false;

// Firebase configuration
export const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Google Drive upload URL
export const DRIVE_UPLOAD_URL = 'YOUR_GOOGLE_DRIVE_UPLOAD_URL';

// Timeout configuration
export const TIMEOUT_MS = 5000;
export const AUTO_SAVE_DELAY_MS = 1000;

// Version info
export const VERSION = 'v4.5';

// Feature flags - control optional features
export const features = {
    search: false,      // Search functionality
    github: true,       // GitHub integration (sync via Actions)
    versions: true,     // Version management
    pdfExport: true     // PDF export
};

// GitHub Actions trigger configuration
// Note: This token only has permission to trigger workflows, cannot read/write code
export const GITHUB_WORKFLOW_TOKEN = 'YOUR_GITHUB_PAT_TOKEN';
export const GITHUB_REPO = 'YOUR_ORG/YOUR_REPO';
