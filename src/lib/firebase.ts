/**
 * Firebase Client SDK Initialization for ByNote
 * Connects to Firebase app: ai-notez
 * Hosting domain: byote.web.app
 *
 * Firebase configuration is driven by client-safe environment variables,
 * falling back to the project configuration specified in deployment instructions.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getDatabase, type Database } from "firebase/database";

export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyDKPWj_3wOxhffuzMx5DQqln2d0WmH038A",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "ai-notez.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "https://ai-notez-default-rtdb.firebaseio.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "ai-notez",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "ai-notez.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    "275128405663",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:275128405663:web:ee5864b447e839c2b35caa",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    "G-FFDFQ48X7K",
};

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

export function getFirebaseRtdb(): Database {
  return getDatabase(getFirebaseApp());
}
