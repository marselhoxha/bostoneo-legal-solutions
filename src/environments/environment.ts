// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8085',
  firebase: {
    apiKey: "AIzaSyCBVt1Ektw51yR9SIftE_8qaIV0NZBfVfs",
    authDomain: "bostoneo-legal-solutions.firebaseapp.com",
    projectId: "bostoneo-legal-solutions",
    storageBucket: "bostoneo-legal-solutions.firebasestorage.app",
    messagingSenderId: "829624532765",
    appId: "1:829624532765:web:90967f574fb8f827926bf4",
    vapidKey: "BGXs3FkZOsBp6OUkIgrNfnG-YwjCO9IYU7bCOgt7m66NTQe26Bkyf0Z-dXcLBmtGUgex4k865ApG4Nxw1JRyfeY",// Public VAPID key for web push notifications
    measurementId: "G-GT3JE1YCYG"
  }
};


/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
