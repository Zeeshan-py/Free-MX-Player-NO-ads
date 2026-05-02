import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_STORAGE_KEY = 'myplayer:settings';
export const PLAYBACK_POSITIONS_STORAGE_KEY = 'myplayer:playback-positions';

export const DEFAULT_SETTINGS = {
  defaultPlaybackSpeed: 1,
  autoplayNextVideo: true,
  resumePlayback: true,
  hardwareAcceleration: true,
  subtitleTextSize: 'Medium',
  subtitleTextColor: 'White',
  subtitleBackground: 'Semi-transparent',
  enableVolumeGesture: true,
  enableBrightnessGesture: true,
  enableDoubleTapSeek: true,
  seekDuration: 10,
};

const SettingsContext = createContext(null);

function sanitizeSettings(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...candidate,
  };
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [resumePositions, setResumePositions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [storedValue, storedPositionsValue] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
          AsyncStorage.getItem(PLAYBACK_POSITIONS_STORAGE_KEY),
        ]);

        if (!isMounted) {
          return;
        }

        if (storedValue) {
          const parsedValue = JSON.parse(storedValue);
          setSettings(sanitizeSettings(parsedValue));
        }

        if (storedPositionsValue) {
          const parsedPositions = JSON.parse(storedPositionsValue);
          setResumePositions(parsedPositions && typeof parsedPositions === 'object' ? parsedPositions : {});
        }
      } catch {
        if (isMounted) {
          setSettings(DEFAULT_SETTINGS);
          setResumePositions({});
        }
      } finally {
        if (isMounted) {
          hasHydratedRef.current = true;
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)).catch(() => undefined);
  }, [settings]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    AsyncStorage.setItem(
      PLAYBACK_POSITIONS_STORAGE_KEY,
      JSON.stringify(resumePositions)
    ).catch(() => undefined);
  }, [resumePositions]);

  const updateSetting = useCallback((key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const updateSettings = useCallback((partialSettings) => {
    setSettings((current) => ({
      ...current,
      ...partialSettings,
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const setResumePosition = useCallback((uri, positionInSeconds) => {
    if (!uri) {
      return;
    }

    setResumePositions((current) => ({
      ...current,
      [uri]: Math.max(0, Math.floor(positionInSeconds || 0)),
    }));
  }, []);

  const getResumePosition = useCallback(
    (uri) => {
      if (!uri) {
        return 0;
      }

      return resumePositions[uri] || 0;
    },
    [resumePositions]
  );

  const value = useMemo(
    () => ({
      settings,
      resumePositions,
      isLoading,
      updateSetting,
      updateSettings,
      resetSettings,
      setResumePosition,
      getResumePosition,
    }),
    [
      getResumePosition,
      isLoading,
      resetSettings,
      resumePositions,
      setResumePosition,
      settings,
      updateSetting,
      updateSettings,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider.');
  }

  return context;
}
