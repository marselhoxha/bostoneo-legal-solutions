// Firebase Service Worker for Push Notifications

// Basic Firebase imports
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// Your Firebase configuration
// Replace with your actual Firebase config from Firebase Console
firebase.initializeApp({
    apiKey: "AIzaSyCBVt1Ektw51yR9SIftE_8qaIV0NZBfVfs",
    authDomain: "bostoneo-legal-solutions.firebaseapp.com",
    projectId: "bostoneo-legal-solutions",
    storageBucket: "bostoneo-legal-solutions.firebasestorage.app",
    messagingSenderId: "829624532765",
    appId: "1:829624532765:web:90967f574fb8f827926bf4",
    measurementId: "G-GT3JE1YCYG"
});

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/images/logo-sm.png',
    badge: '/assets/images/badge.png',
    data: payload.data
  };

  // Show the notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received: ', event);

  event.notification.close();
  
  // Handle navigation based on payload data if available
  if (event.notification.data && event.notification.data.url) {
    clients.openWindow(event.notification.data.url);
  } else {
    // Default navigation
    clients.openWindow('/');
  }
}); 
 