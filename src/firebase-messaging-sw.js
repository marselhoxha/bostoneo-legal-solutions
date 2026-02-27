// Firebase Cloud Messaging Service Worker
// WARNING: Do NOT add credentials here. This file is committed to git.
// The __FIREBASE_CONFIG__ placeholder is replaced at CI build time
// by the "Inject Firebase config into Service Worker" step in ci.yml.
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js');

firebase.initializeApp(__FIREBASE_CONFIG__);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Legience', {
    body: body || '',
    icon: icon || '/assets/images/logo-sm.png'
  });
});
