---
description: How to build and run the Splitty iOS app
---


1. Start the dev build and Metro bundler:

npx expo run:ios --device --scheme Splitty


2. Build and install the Release version on your phone:

npx expo run:ios --device --scheme Splitty --configuration Release

3. just to restart metro without rebuilding
npx expo start --dev-client
