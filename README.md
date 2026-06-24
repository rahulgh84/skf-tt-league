# SKF TT League Platform v3

GitHub Pages + Firebase Firestore table tennis league platform.

## Files
- `index.html`
- `assets/app.js`
- `assets/styles.css`
- `assets/firebase-config.js`

## Default passwords
- Manager: `skf2026`
- Scorer: `score2026`

Passwords can be changed from the Settings page after Manager login.

## Firebase
This package uses one Firestore document:
`league/skf-tt-league`

Firestore rules for simple community use:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

## Deploy
Upload all files to GitHub repo `skf-tt-league`, then enable GitHub Pages from branch `main`, folder `/root`.
