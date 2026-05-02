# MyPlayer

MyPlayer is an ad-free Android video player built with React Native, Expo, and VLC playback.

## Requirements

- Node.js `20.19+` recommended
- Expo CLI via `npx`
- EAS CLI for cloud builds: `npm install -g eas-cli`

## Run Locally

```bash
npm install
npx expo start
```

## Build APK

```bash
eas build --platform android
```

## Notes

- This project uses custom native code through `react-native-vlc-media-player`, so use a development build instead of Expo Go for full playback testing.
- App package name: `com.zeeshan.myplayer`
- App version: `1.0.0`

## Project Structure

- `src/components/` reusable UI components
- `src/hooks/` shared hooks and settings store
- `src/screens/` app screens
- `src/utils/` helpers
