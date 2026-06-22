const admin = require('firebase-admin');
const path = require('path');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK using service account JSON.
 * Gracefully degrades if credentials are missing (dev mode).
 */
const initFirebase = () => {
  try {
    const serviceAccountPath = path.resolve(
      process.env.FIREBASE_PRIVATE_KEY_PATH || './firebase-service-account.json'
    );

    // Check if the service account file exists
    const fs = require('fs');
    if (!fs.existsSync(serviceAccountPath)) {
      console.log('⚠️ Firebase service account not found at', serviceAccountPath, '- FCM disabled');
      return null;
    }

    if (admin.apps && admin.apps.length > 0) {
      firebaseApp = admin.app();
    } else {
      // firebase-admin v12+ exposes cert() directly on admin
      // (older versions used admin.credential.cert())
      const certFn = admin.cert || (admin.credential && admin.credential.cert);
      if (!certFn) {
        console.log('⚠️ Firebase cert() not available - FCM disabled');
        return null;
      }
      firebaseApp = admin.initializeApp({
        credential: certFn(serviceAccountPath),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      console.log('🔥 Firebase Admin initialized');
    }

    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase init error:', error.message);
    console.log('⚠️ Running without Firebase - FCM disabled');
    return null;
  }
};

/**
 * Send a push notification via FCM
 * @param {String} token - FCM device token
 * @param {Object} payload - { title, body, data }
 * @returns {Promise<String|null>} messageId or null
 */
const sendNotification = async (token, { title, body, data = {} }) => {
  if (!firebaseApp || !token) return null;

  try {
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ FCM sent:', response);
    return response;
  } catch (error) {
    console.error('❌ FCM error:', error.message);
    // If the token is invalid, the caller can clear it
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      throw new Error('INVALID_TOKEN');
    }
    return null;
  }
};

/**
 * Send to multiple tokens (multicast)
 */
const sendMulticast = async (tokens, { title, body, data = {} }) => {
  if (!firebaseApp || !tokens || tokens.length === 0) return null;

  try {
    const message = {
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      )
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ FCM multicast: ${response.successCount}/${tokens.length} sent`);
    return response;
  } catch (error) {
    console.error('❌ FCM multicast error:', error.message);
    return null;
  }
};

module.exports = {
  initFirebase,
  sendNotification,
  sendMulticast,
  isFirebaseReady: () => firebaseApp !== null
};
