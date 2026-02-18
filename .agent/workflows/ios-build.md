---
description: How to build and run the Splitty iOS app
---

## 🌙 Night (Development Mode)
Use this while actively coding — gives you instant hot reload.

// turbo
1. Start the dev build and Metro bundler:
```
npx expo run:ios --device --scheme Splitty
```
- Select "Yeah its my iPhone" when prompted
- Metro stays running — keep the terminal open
- Changes to `.tsx` files appear instantly on your phone (hot reload)
- To stop: `Ctrl+C` in the terminal

---

## ☀️ Morning (Standalone Release for Friends)
Use this to show friends — no Mac needed after install.

// turbo
1. Build and install the Release version on your phone:
```
npx expo run:ios --device --scheme Splitty --configuration Release
```
- Select "Yeah its my iPhone" when prompted
- Wait ~5 minutes for build + install
- Once installed, close the terminal — the app runs standalone
- Your friends can use the app without your Mac being on

---

## 📝 Notes
- The Release build has the JS bundle baked in — no Metro needed
- The Debug build always needs Metro running on your Mac
- After making changes at night, always do a fresh Release build in the morning
- Both builds install as "Splitty" on your phone (same icon, same app)
