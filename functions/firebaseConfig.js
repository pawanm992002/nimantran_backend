var admin = require("firebase-admin");

const serviceAccount = {
  "type": process.env.TYPE,
  "project_id": process.env.PROJECT_ID,
  "private_key_id": process.env.PRIVATE_KEY_ID,
  "private_key": process.env.PRIVATE_KEY,
  "client_email": process.env.CLIENT_EMAIL,
  "client_id": process.env.CLIENT_ID,
  "auth_uri": process.env.AUTH_URI,
  "token_uri": process.env.TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL,
  "universe_domain": process.env.UNIVERSE_DOMAIN,
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.STORAGE_BUCKET,
  databaseURL: process.env.DATABASE_URL,
});

// Access Firebase services
const firebaseStorage = admin.storage().bucket();
const db = admin.database(); // Access Firebase Realtime Database

// Export the initialized app and firebase storage
module.exports = { admin, firebaseStorage, db };
