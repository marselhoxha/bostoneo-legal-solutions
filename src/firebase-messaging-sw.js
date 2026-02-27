// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "REDACTED_FIREBASE_API_KEY",
  authDomain: "bostoneo-legal-solutions.firebaseapp.com",
  projectId: "bostoneo-legal-solutions",
  storageBucket: "bostoneo-legal-solutions.firebasestorage.app",
  messagingSenderId: "REDACTED_FIREBASE_SENDER_ID",
  appId: "REDACTED_FIREBASE_APP_ID"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Legience', {
    body: body || '',
    icon: icon || '/assets/images/logo-sm.png'
  });
});
