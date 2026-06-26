# SKF TT League Analytics Setup

This update adds Google Analytics 4 / Firebase Analytics tracking to the SKF TT League site.

## What it tracks

- App open
- Page views: dashboard, schedule, scores, standings, etc.
- Login success by role: manager or scorer
- Login failed attempts
- Player/group/stadium creation
- Group match generation
- Manual match creation
- Live scoring point added
- Undo point
- Manual score saved
- Walkover declared
- Standings export
- Backup download
- League reset

## Where to see data

Firebase Console → Analytics → Events

or

Google Analytics → Reports → Engagement → Events

## Required Firebase config

Your `assets/firebase-config.js` must include a valid `measurementId`, for example:

```js
window.firebaseConfig = {
  apiKey: "...",
  authDomain: "skf-tt-2026.firebaseapp.com",
  projectId: "skf-tt-2026",
  storageBucket: "skf-tt-2026.firebasestorage.app",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "G-22ZXFBM9LC"
};
```

## Notes

Analytics does not show exact personal identity unless you build user accounts later. It shows device/browser, city-level location, page views, and custom actions.
