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


## v3.1 Live Scoring Update
- Scorers and managers can update score point-by-point during a match.
- Supports Best of 1, 3, 5, or 7.
- Configurable points per game and win-by value.
- Undo last point, start next game, reset score, and manual final score entry.
- Live score saves to Firebase after every point.


## Standings Update
Standings now include Pts = Wins x 2, and sort by Pts, Diff, PF, then player name.

# SKF TT League Platform v3.2 Tournament Bundle

Includes:
- SKF tournament logo in header
- PWA/offline app support
- Live point-by-point scoring
- Standings: Rank, Player, P, W, L, Pts, PF, PA, Diff
- Match status colors:
  - Scheduled = Yellow
  - Live = Red
  - Completed = Green
- Dashboard counters for Scheduled, Live, Completed
- Stadiums, Schedule, Groups, Knockouts, Hall of Fame, Settings

Upload/replace all files in the GitHub repository `skf-tt-league`.

Keep your Firebase project as-is. The included `assets/firebase-config.js` may be replaced with your existing Firebase config if needed.
