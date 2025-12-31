// Firebase configuration
// IMPORTANT: Replace these values with your Firebase project config
// Get these from: https://console.firebase.google.com > Project Settings > Your apps > Web app

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ============ SONG REQUESTS ============

export async function addSongRequest({ type, content, tip }) {
    try {
        await addDoc(collection(db, 'requests'), {
            type,
            content,
            tip: tip || 0,
            status: 'pending',
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Error adding request:', error);
        throw error;
    }
}

export function subscribeToRequests(callback) {
    const q = query(collection(db, 'requests'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(requests);
    });
}

export async function archiveRequest(id) {
    try {
        await updateDoc(doc(db, 'requests', id), {
            status: 'archived'
        });
    } catch (error) {
        console.error('Error archiving request:', error);
        throw error;
    }
}

// ============ BOOKINGS ============

export async function addBooking(bookingData) {
    try {
        await addDoc(collection(db, 'bookings'), {
            name: bookingData.name,
            phone: bookingData.phone,
            contactPreference: bookingData.contactPreference,
            date: bookingData.date,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            timeRange: bookingData.timeRange,
            eventType: bookingData.eventType,
            status: 'new',
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Error adding booking:', error);
        throw error;
    }
}

// ============ AUTHENTICATION ============

export async function signInDJ(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutDJ() {
    return signOut(auth);
}

export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

export { db, auth };
