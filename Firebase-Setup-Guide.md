# Firebase Push Notifications Setup Guide

## 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter "BostonEO Solutions" as your project name
4. Accept the terms and continue
5. Configure Google Analytics (optional)
6. Click "Create project"

## 2. Register Your Web App

1. On your Firebase project dashboard, click the web icon (</>) to add a web app
2. Register the app with the name "BostonEO Solutions Web App"
3. Check "Set up Firebase Hosting" (optional)
4. Click "Register app"
5. **Important:** Copy the Firebase configuration values shown (you'll need these for step 3)

## 3. Configure Your Angular App

1. Open `src/environments/environment.ts`
2. Replace the placeholder values with your actual Firebase config:
```typescript
firebase: {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_ACTUAL_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID",
  vapidKey: "YOUR_ACTUAL_VAPID_KEY" // You'll get this in step 4
}
```

3. Also update `src/environments/environment.prod.ts` with the same values

4. Open `src/assets/js/firebase-messaging-sw.js` and update the Firebase config there too:
```javascript
firebase.initializeApp({
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_ACTUAL_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
});
```

## 4. Set Up Cloud Messaging for Web

1. In the Firebase Console, go to Project Settings > Cloud Messaging
2. Under the Web configuration section, click "Generate key pair"
3. Copy the generated VAPID key
4. Paste it as the value for `vapidKey` in your environment files

## 5. Create Service Account for Backend

1. In Firebase Console, go to Project Settings > Service accounts
2. Click "Generate new private key" for Firebase Admin SDK
3. Save the downloaded JSON file
4. Copy this file to `backend/src/main/resources/firebase-service-account.json`

## 6. Run Database Migration

The database migration script for notification tokens has already been created. Run it with:

```bash
cd backend
mvn spring-boot:run
```

This will automatically execute the migration script that creates the notification_tokens table.

## 7. Test Push Notifications

1. Start both your backend and frontend applications:
```bash
# Terminal 1 - Backend
cd backend
mvn spring-boot:run

# Terminal 2 - Frontend
cd src
ng serve
```

2. When you first access the application, your browser will ask for notification permission
3. Accept the permission to register your device
4. Set up a deadline with reminders to test the notifications

## Troubleshooting

1. **Notification permission denied**: Go to your browser settings and reset notification permissions for the site
2. **Firebase initialization errors**: Double-check your configuration values in both environment.ts and service worker
3. **Backend errors**: Make sure the firebase-service-account.json file is correctly placed and formatted 
 