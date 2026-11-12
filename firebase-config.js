/*
 * SD Delivery web app in Firebase project sddelivery, Realtime Database us-central1.
 * Never put a service-account key in this browser project.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB3noKDQpJN-W8e3u3HBbkk9df_ILBCgYo',
  authDomain: 'sddelivery.firebaseapp.com',
  databaseURL: 'https://sddelivery-default-rtdb.firebaseio.com',
  projectId: 'sddelivery',
  messagingSenderId: '1024517867877',
  appId: '1:1024517867877:web:3bd16279d6c956f5b3398c'
};

const databaseUrlIsValid = /^https:\/\/[^/]+(?:\/.*)?$/.test(firebaseConfig.databaseURL)
  && !firebaseConfig.databaseURL.startsWith('https://PEGA_');

export const missingFirebaseFields = [
  ...(!databaseUrlIsValid ? ['databaseURL'] : [])
];
export const firebaseConfigured = missingFirebaseFields.length === 0;

let auth = null;
let db = null;

if (firebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
}

export { auth, db };
