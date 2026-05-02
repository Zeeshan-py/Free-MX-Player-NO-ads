import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Brightness from 'expo-brightness';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { VLCPlayer } from 'react-native-vlc-media-player';

import { useSettings } from '../hooks/useSettings';
import formatTime from '../utils/formatTime';

const CONTROLS_HIDE_DELAY = 3000;
const DOUBLE_TAP_DELAY = 260;
const BRIGHTNESS_STEP_RANGE = 0.8;
const PLAYER_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const KEEP_AWAKE_TAG = 'myplayer-video-session';
const INDICATOR_TYPE = {
  brightness: 'brightness',
  volume: 'volume',
  speed: 'speed',
};

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getTitleFromUri(uri = '') {
  const decodedUri = decodeURIComponent(uri).split('?')[0];
  const filename = decodedUri.split('/').filter(Boolean).pop() || 'Unknown Video';
  return filename.replace(/\.[^/.]+$/, '');
}

function getTimeDivisor(rawDuration, fallbackDuration) {
  if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
    return 1;
  }

  if (Number.isFinite(fallbackDuration) && fallbackDuration > 0) {
    const secondsDistance = Math.abs(rawDuration - fallbackDuration);
    const millisecondsDistance = Math.abs(rawDuration / 1000 - fallbackDuration);
    return millisecondsDistance < secondsDistance ? 1000 : 1;
  }

  return rawDuration > 50000 ? 1000 : 1;
}

function normalizeProgressPayload(payload, fallbackDuration) {
  const divisor = getTimeDivisor(payload?.duration, fallbackDuration);
  const duration = Number.isFinite(payload?.duration) ? payload.duration / divisor : fallbackDuration || 0;
  const currentTime = Number.isFinite(payload?.currentTime) ? payload.currentTime / divisor : 0;

  return {
    duration,
    currentTime,
    remainingTime: Number.isFinite(payload?.remainingTime) ? payload.remainingTime / divisor : 0,
    position: clamp(
      Number.isFinite(payload?.position)
        ? payload.position
        : duration > 0
          ? currentTime / duration
          : 0,
      0,
      1
    ),
  };
}

function parseSrtTimestamp(value = '') {
  const normalized = value.trim().replace(',', '.');
  const [hours = '0', minutes = '0', seconds = '0'] = normalized.split(':');
  return (Number(hours) * 3600) + (Number(minutes) * 60) + Number(seconds);
}

function parseSrtFile(source = '') {
  return source
    .replace(/\r/g, '')
    .trim()
    .split('\n\n')
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .map((lines) => {
      const timeLine = lines.find((line) => line.includes('-->'));

      if (!timeLine) {
        return null;
      }

      const [start, end] = timeLine.split('-->').map((part) => parseSrtTimestamp(part));
      const text = lines.slice(lines.indexOf(timeLine) + 1).join('\n');

      if (!text) {
        return null;
      }

      return { start, end, text };
    })
    .filter(Boolean);
}

function findSubtitleAtTime(subtitles, currentTime) {
  return subtitles.find((entry) => currentTime >= entry.start && currentTime <= entry.end) || null;
}

function ActionButton({ iconName, label, onPress, disabled }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
    >
      <Ionicons color={disabled ? '#5A5A5A' : '#FFFFFF'} name={iconName} size={22} />
      {label ? <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>{label}</Text> : null}
    </Pressable>
  );
}

function SecondaryButton({ iconName, onPress, active, disabled }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        active && styles.secondaryButtonActive,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
    >
      <Ionicons color={active ? '#E53935' : disabled ? '#5A5A5A' : '#FFFFFF'} name={iconName} size={20} />
    </Pressable>
  );
}

export default function PlayerScreen({ navigation, route }) {
  const { settings, getResumePosition, setResumePosition } = useSettings();
  const initialVideoList = route.params?.videoList || route.params?.videos || [];
  const initialIndexParam = route.params?.currentIndex ?? route.params?.initialIndex ?? 0;
  const initialCurrentVideo = route.params?.currentVideo || null;
  const initialVideoUri =
    route.params?.videoUri ||
    initialCurrentVideo?.uri ||
    initialVideoList[initialIndexParam]?.uri ||
    '';

  const playerRef = useRef(null);
  const autoHideTimeoutRef = useRef(null);
  const singleTapTimeoutRef = useRef(null);
  const indicatorTimeoutRef = useRef(null);
  const doubleTapFeedbackTimeoutRef = useRef(null);
  const brightnessInitialRef = useRef(0.5);
  const lastTapRef = useRef({ time: 0, side: null });
  const gestureStartRef = useRef({ side: INDICATOR_TYPE.volume, brightness: 0.5, volume: 1 });
  const lastSavedProgressRef = useRef(0);
  const pendingResumePositionRef = useRef(0);
  const hasAppliedResumeRef = useRef(false);

  const [videoList] = useState(initialVideoList);
  const [currentIndex, setCurrentIndex] = useState(
    clamp(initialIndexParam, 0, Math.max(initialVideoList.length - 1, 0))
  );
  const [currentUri, setCurrentUri] = useState(initialVideoUri);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialCurrentVideo?.duration || 0);
  const [playbackRate, setPlaybackRate] = useState(settings.defaultPlaybackSpeed);
  const [brightnessLevel, setBrightnessLevel] = useState(0.5);
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [indicator, setIndicator] = useState(null);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState(null);
  const [subtitleEntries, setSubtitleEntries] = useState([]);
  const [activeSubtitle, setActiveSubtitle] = useState(null);
  const [subtitleLabel, setSubtitleLabel] = useState('Subtitles');
  const [playerError, setPlayerError] = useState('');
  const [seekToken, setSeekToken] = useState(undefined);

  const currentVideo = useMemo(() => {
    const fromList = videoList[currentIndex];

    if (fromList?.uri) {
      return fromList;
    }

    if (initialCurrentVideo?.uri === currentUri) {
      return initialCurrentVideo;
    }

    return {
      uri: currentUri,
      title: getTitleFromUri(currentUri),
      duration: 0,
    };
  }, [currentIndex, currentUri, initialCurrentVideo, videoList]);

  const displayedCurrentTime = isScrubbing && duration > 0 ? scrubValue * duration : currentTime;
  const currentTitle = currentVideo?.title || getTitleFromUri(currentUri);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < videoList.length - 1;
  const seekStepSeconds = settings.seekDuration || 10;

  const subtitleTextStyles = useMemo(
    () => [
      styles.subtitleText,
      settings.subtitleTextSize === 'Small' && styles.subtitleTextSmall,
      settings.subtitleTextSize === 'Large' && styles.subtitleTextLarge,
      settings.subtitleTextColor === 'Yellow' && styles.subtitleTextYellow,
      settings.subtitleBackground === 'None' && styles.subtitleTextNoBackground,
    ],
    [
      settings.subtitleBackground,
      settings.subtitleTextColor,
      settings.subtitleTextSize,
    ]
  );

  const showToast = useCallback((message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    Alert.alert('MyPlayer', message);
  }, []);

  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    clearAutoHideTimer();

    if (paused || locked) {
      return;
    }

    autoHideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_HIDE_DELAY);
  }, [clearAutoHideTimer, locked, paused]);

  const showIndicator = useCallback((type, value) => {
    if (indicatorTimeoutRef.current) {
      clearTimeout(indicatorTimeoutRef.current);
    }

    setIndicator({ type, value });
    indicatorTimeoutRef.current = setTimeout(() => {
      setIndicator(null);
    }, 900);
  }, []);

  const showDoubleTapFeedback = useCallback((side, label) => {
    if (doubleTapFeedbackTimeoutRef.current) {
      clearTimeout(doubleTapFeedbackTimeoutRef.current);
    }

    setDoubleTapFeedback({ side, label });
    doubleTapFeedbackTimeoutRef.current = setTimeout(() => {
      setDoubleTapFeedback(null);
    }, 700);
  }, []);

  const performSeek = useCallback(
    (nextTimeInSeconds) => {
      const safeDuration = duration || currentVideo?.duration || 0;

      if (!safeDuration) {
        return;
      }

      const clampedTime = clamp(nextTimeInSeconds, 0, safeDuration);
      const fraction = clamp(clampedTime / safeDuration, 0, 1);

      setCurrentTime(clampedTime);

      if (playerRef.current?.seek) {
        playerRef.current.seek(fraction);
      }

      setSeekToken(fraction);
      setTimeout(() => {
        setSeekToken(undefined);
      }, 0);
    },
    [currentVideo?.duration, duration]
  );

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  const togglePlayPause = useCallback(() => {
    setPaused((current) => !current);
    revealControls();
  }, [revealControls]);

  const skipBySeconds = useCallback(
    (seconds) => {
      performSeek(currentTime + seconds);
      revealControls();
    },
    [currentTime, performSeek, revealControls]
  );

  const goToVideoAtIndex = useCallback(
    (nextIndex) => {
      const nextVideo = videoList[nextIndex];

      if (!nextVideo?.uri) {
        return;
      }

      hasAppliedResumeRef.current = false;
      pendingResumePositionRef.current = settings.resumePlayback ? getResumePosition(nextVideo.uri) : 0;
      lastSavedProgressRef.current = 0;
      setCurrentIndex(nextIndex);
      setCurrentUri(nextVideo.uri);
      setCurrentTime(0);
      setDuration(nextVideo.duration || 0);
      setPaused(false);
      setIsBuffering(true);
      setPlayerError('');
      setActiveSubtitle(null);
      setPlaybackRate(settings.defaultPlaybackSpeed);
      revealControls();
    },
    [
      getResumePosition,
      revealControls,
      settings.defaultPlaybackSpeed,
      settings.resumePlayback,
      videoList,
    ]
  );

  const handleSingleTap = useCallback(
    (locationX) => {
      if (locked) {
        return;
      }

      const halfWidth = Dimensions.get('window').width / 2;
      const tappedSide = locationX < halfWidth ? 'left' : 'right';
      const now = Date.now();

      if (
        settings.enableDoubleTapSeek &&
        lastTapRef.current.side === tappedSide &&
        now - lastTapRef.current.time <= DOUBLE_TAP_DELAY
      ) {
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }

        lastTapRef.current = { time: 0, side: null };

        if (tappedSide === 'left') {
          skipBySeconds(-seekStepSeconds);
          showDoubleTapFeedback('left', `-${seekStepSeconds}s`);
        } else {
          skipBySeconds(seekStepSeconds);
          showDoubleTapFeedback('right', `+${seekStepSeconds}s`);
        }

        return;
      }

      lastTapRef.current = { time: now, side: tappedSide };

      singleTapTimeoutRef.current = setTimeout(() => {
        setControlsVisible((current) => {
          const nextValue = !current;

          if (nextValue) {
            scheduleAutoHide();
          } else {
            clearAutoHideTimer();
          }

          return nextValue;
        });
      }, DOUBLE_TAP_DELAY);
    },
    [
      clearAutoHideTimer,
      locked,
      scheduleAutoHide,
      seekStepSeconds,
      settings.enableDoubleTapSeek,
      showDoubleTapFeedback,
      skipBySeconds,
    ]
  );

  const pickSubtitleFile = useCallback(async () => {
    revealControls();

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.name?.toLowerCase().endsWith('.srt')) {
        Alert.alert('Unsupported subtitle', 'Please choose a .srt subtitle file.');
        return;
      }

      const content = await FileSystem.readAsStringAsync(asset.uri);
      const parsedEntries = parseSrtFile(content);

      if (!parsedEntries.length) {
        Alert.alert('Subtitle error', 'The selected subtitle file could not be parsed.');
        return;
      }

      setSubtitleEntries(parsedEntries);
      setSubtitleLabel(asset.name);
      setActiveSubtitle(findSubtitleAtTime(parsedEntries, currentTime));
    } catch {
      Alert.alert('Subtitle error', 'Unable to load the selected subtitle file.');
    }
  }, [currentTime, revealControls]);

  const cyclePlaybackRate = useCallback(() => {
    const currentSpeedIndex = PLAYER_SPEEDS.findIndex((speed) => speed === playbackRate);
    const nextSpeed = PLAYER_SPEEDS[(currentSpeedIndex + 1) % PLAYER_SPEEDS.length];
    setPlaybackRate(nextSpeed);
    showIndicator(INDICATOR_TYPE.speed, nextSpeed);
    revealControls();
  }, [playbackRate, revealControls, showIndicator]);

  const toggleFullscreen = useCallback(async () => {
    const nextFullscreenValue = !isFullscreen;
    setIsFullscreen(nextFullscreenValue);
    revealControls();

    try {
      if (nextFullscreenValue) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    } catch {
      Alert.alert(
        'Orientation unavailable',
        'Install expo-screen-orientation to enable fullscreen rotation in the player.'
      );
    }
  }, [isFullscreen, revealControls]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !locked &&
          (settings.enableBrightnessGesture || settings.enableVolumeGesture) &&
          Math.abs(gestureState.dy) > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: (event) => {
          const screenWidth = Dimensions.get('window').width;
          const isLeftSide = event.nativeEvent.locationX < screenWidth / 2;

          gestureStartRef.current = {
            side: isLeftSide ? INDICATOR_TYPE.brightness : INDICATOR_TYPE.volume,
            brightness: brightnessLevel,
            volume: volumeLevel,
          };

          revealControls();
        },
        onPanResponderMove: async (_, gestureState) => {
          const screenHeight = Dimensions.get('window').height;
          const movementRatio = clamp((-gestureState.dy / screenHeight) * BRIGHTNESS_STEP_RANGE, -1, 1);

          if (
            gestureStartRef.current.side === INDICATOR_TYPE.brightness &&
            settings.enableBrightnessGesture
          ) {
            const nextBrightness = clamp(gestureStartRef.current.brightness + movementRatio, 0.05, 1);
            setBrightnessLevel(nextBrightness);
            showIndicator(INDICATOR_TYPE.brightness, nextBrightness);

            try {
              await Brightness.setBrightnessAsync(nextBrightness);
            } catch {
              // Ignore brightness API failures on unsupported devices.
            }
          } else if (settings.enableVolumeGesture) {
            const nextVolume = clamp(gestureStartRef.current.volume + movementRatio, 0, 1);
            setVolumeLevel(nextVolume);
            showIndicator(INDICATOR_TYPE.volume, nextVolume);
          }
        },
      }),
    [
      brightnessLevel,
      locked,
      revealControls,
      settings.enableBrightnessGesture,
      settings.enableVolumeGesture,
      showIndicator,
      volumeLevel,
    ]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    setPlaybackRate(settings.defaultPlaybackSpeed);
  }, [currentUri, settings.defaultPlaybackSpeed]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!currentUri || !currentUri.startsWith('file://')) {
        return;
      }

      try {
        const fileInfo = await FileSystem.getInfoAsync(currentUri);

        if (!isMounted || fileInfo.exists) {
          return;
        }

        showToast('Video file not found');
        navigation.goBack();
      } catch {
        if (isMounted) {
          showToast('Video file not found');
          navigation.goBack();
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentUri, navigation, showToast]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const initialBrightness = await Brightness.getBrightnessAsync();

        if (mounted) {
          brightnessInitialRef.current = initialBrightness;
          setBrightnessLevel(initialBrightness);
        }
      } catch {
        // Keep default brightness if the API isn't available.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!paused) {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
      scheduleAutoHide();
    } else {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
      clearAutoHideTimer();
    }

    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [clearAutoHideTimer, paused, scheduleAutoHide]);

  useEffect(() => {
    if (subtitleEntries.length) {
      setActiveSubtitle(findSubtitleAtTime(subtitleEntries, currentTime));
    }
  }, [currentTime, subtitleEntries]);

  useEffect(() => {
    hasAppliedResumeRef.current = false;
    pendingResumePositionRef.current = settings.resumePlayback ? getResumePosition(currentUri) : 0;
    lastSavedProgressRef.current = 0;
  }, [currentUri, getResumePosition, settings.resumePlayback]);

  useEffect(() => {
    if (!settings.resumePlayback) {
      return;
    }

    if (Math.abs(currentTime - lastSavedProgressRef.current) < 2) {
      return;
    }

    lastSavedProgressRef.current = currentTime;
    setResumePosition(currentUri, currentTime);
  }, [currentTime, currentUri, setResumePosition, settings.resumePlayback]);

  useEffect(() => {
    return () => {
      clearAutoHideTimer();

      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }

      if (indicatorTimeoutRef.current) {
        clearTimeout(indicatorTimeoutRef.current);
      }

      if (doubleTapFeedbackTimeoutRef.current) {
        clearTimeout(doubleTapFeedbackTimeoutRef.current);
      }

      Brightness.setBrightnessAsync(brightnessInitialRef.current).catch(() => undefined);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [clearAutoHideTimer]);

  const sliderValue = duration > 0 ? clamp(displayedCurrentTime / duration, 0, 1) : 0;

  return (
    <View style={styles.container}>
      <StatusBar animated backgroundColor="#000000" hidden={isFullscreen} translucent />

      <VLCPlayer
        ref={playerRef}
        autoplay
        onBuffering={() => setIsBuffering(true)}
        onEnd={() => {
          setResumePosition(currentUri, 0);

          if (settings.autoplayNextVideo && canGoNext) {
            goToVideoAtIndex(currentIndex + 1);
          } else {
            setPaused(true);
            setControlsVisible(true);
          }
        }}
        onError={() => {
          setIsBuffering(false);
          setPlayerError('Unable to play this video.');
          setControlsVisible(true);
        }}
        onLoad={(event) => {
          const normalized = normalizeProgressPayload(
            { duration: event?.duration, currentTime: 0, remainingTime: 0, position: 0 },
            currentVideo?.duration || 0
          );

          const resolvedDuration = normalized.duration || currentVideo?.duration || 0;
          setDuration(resolvedDuration);
          setIsBuffering(false);

          const resumePosition = pendingResumePositionRef.current;

          if (
            settings.resumePlayback &&
            !hasAppliedResumeRef.current &&
            resumePosition > 0 &&
            resumePosition < resolvedDuration - 3
          ) {
            hasAppliedResumeRef.current = true;
            setTimeout(() => performSeek(resumePosition), 250);
          }
        }}
        onPaused={() => setPaused(true)}
        onPlaying={(event) => {
          const normalized = normalizeProgressPayload(
            {
              duration: event?.duration,
              currentTime,
              remainingTime: 0,
              position: duration > 0 ? currentTime / duration : 0,
            },
            currentVideo?.duration || duration || 0
          );

          setDuration(normalized.duration || duration);
          setIsBuffering(false);
          setPaused(false);
        }}
        onProgress={(event) => {
          const normalized = normalizeProgressPayload(event, currentVideo?.duration || duration || 0);

          setDuration(normalized.duration || duration);

          if (!isScrubbing) {
            setCurrentTime(normalized.currentTime);
          }
        }}
        paused={paused}
        playInBackground
        rate={playbackRate}
        resizeMode="contain"
        seek={seekToken}
        source={{
          uri: currentUri,
          initOptions: settings.hardwareAcceleration
            ? ['--avcodec-hw=any']
            : ['--avcodec-hw=none'],
        }}
        style={styles.player}
        videoAspectRatio="16:9"
        volume={Math.round(volumeLevel * 100)}
      />

      <TouchableWithoutFeedback onPress={(event) => handleSingleTap(event.nativeEvent.locationX)}>
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      </TouchableWithoutFeedback>

      {activeSubtitle?.text ? (
        <View pointerEvents="none" style={styles.subtitleWrapper}>
          <Text style={subtitleTextStyles}>{activeSubtitle.text}</Text>
        </View>
      ) : null}

      {indicator ? (
        <View pointerEvents="none" style={styles.indicatorCard}>
          <Ionicons
            color="#FFFFFF"
            name={
              indicator.type === INDICATOR_TYPE.brightness
                ? 'sunny-outline'
                : indicator.type === INDICATOR_TYPE.speed
                  ? 'speedometer-outline'
                  : 'volume-high-outline'
            }
            size={24}
          />
          <Text style={styles.indicatorText}>
            {indicator.type === INDICATOR_TYPE.brightness
              ? 'Brightness'
              : indicator.type === INDICATOR_TYPE.speed
                ? 'Speed'
                : 'Volume'}
          </Text>
          <Text style={styles.indicatorValue}>
            {indicator.type === INDICATOR_TYPE.speed
              ? `${indicator.value}x`
              : `${Math.round(indicator.value * 100)}%`}
          </Text>
        </View>
      ) : null}

      {doubleTapFeedback ? (
        <View
          pointerEvents="none"
          style={[
            styles.doubleTapBadge,
            doubleTapFeedback.side === 'left' ? styles.doubleTapLeft : styles.doubleTapRight,
          ]}
        >
          <Text style={styles.doubleTapText}>{doubleTapFeedback.label}</Text>
        </View>
      ) : null}

      {isBuffering ? (
        <View pointerEvents="none" style={styles.bufferingState}>
          <ActivityIndicator color="#E53935" size="large" />
        </View>
      ) : null}

      {playerError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{playerError}</Text>
        </View>
      ) : null}

      {controlsVisible && !locked ? (
        <SafeAreaView edges={['top', 'bottom']} pointerEvents="box-none" style={styles.overlay}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} style={styles.topBarButton}>
              <Ionicons color="#FFFFFF" name="arrow-back" size={24} />
            </Pressable>

            <Text numberOfLines={1} style={styles.videoTitle}>
              {currentTitle}
            </Text>

            <Pressable
              onPress={() => {
                setLocked(true);
                setControlsVisible(false);
              }}
              style={styles.topBarButton}
            >
              <Ionicons color="#FFFFFF" name="lock-closed-outline" size={22} />
            </Pressable>
          </View>

          <View style={styles.centerControls}>
            <Pressable onPress={togglePlayPause} style={styles.playPauseButton}>
              <Ionicons color="#FFFFFF" name={paused ? 'play' : 'pause'} size={34} />
            </Pressable>
          </View>

          <View style={styles.bottomBar}>
            <Slider
              maximumTrackTintColor="rgba(255,255,255,0.24)"
              minimumTrackTintColor="#E53935"
              onSlidingComplete={(value) => {
                performSeek(value * duration);
                setIsScrubbing(false);
                scheduleAutoHide();
              }}
              onSlidingStart={() => {
                setIsScrubbing(true);
                revealControls();
              }}
              onValueChange={(value) => setScrubValue(value)}
              step={0}
              style={styles.slider}
              thumbTintColor="#E53935"
              value={sliderValue}
            />

            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(displayedCurrentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            <View style={styles.transportRow}>
              <ActionButton
                disabled={!canGoPrevious}
                iconName="play-skip-back"
                onPress={() => goToVideoAtIndex(currentIndex - 1)}
              />
              <ActionButton
                iconName="play-back"
                label={`${seekStepSeconds}s`}
                onPress={() => skipBySeconds(-seekStepSeconds)}
              />
              <Pressable onPress={togglePlayPause} style={styles.primaryTransportButton}>
                <Ionicons color="#FFFFFF" name={paused ? 'play' : 'pause'} size={28} />
              </Pressable>
              <ActionButton
                iconName="play-forward"
                label={`${seekStepSeconds}s`}
                onPress={() => skipBySeconds(seekStepSeconds)}
              />
              <ActionButton
                disabled={!canGoNext}
                iconName="play-skip-forward"
                onPress={() => goToVideoAtIndex(currentIndex + 1)}
              />
            </View>

            <View style={styles.utilityRow}>
              <Pressable onPress={cyclePlaybackRate} style={styles.utilityChip}>
                <Ionicons color="#FFFFFF" name="speedometer-outline" size={18} />
                <Text style={styles.utilityChipText}>{playbackRate}x</Text>
              </Pressable>

              <SecondaryButton
                active={isFullscreen}
                iconName={isFullscreen ? 'contract-outline' : 'expand-outline'}
                onPress={toggleFullscreen}
              />

              <Pressable onPress={pickSubtitleFile} style={styles.utilityChip}>
                <MaterialIcons color="#FFFFFF" name="subtitles" size={18} />
                <Text numberOfLines={1} style={styles.utilityChipText}>
                  {subtitleEntries.length ? 'Loaded' : 'Subtitles'}
                </Text>
              </Pressable>
            </View>

            {subtitleEntries.length ? (
              <Text numberOfLines={1} style={styles.subtitleMeta}>
                {subtitleLabel}
              </Text>
            ) : null}
          </View>
        </SafeAreaView>
      ) : null}

      {locked ? (
        <View style={styles.lockedOverlay}>
          <Pressable
            onPress={() => {
              setLocked(false);
              setControlsVisible(true);
              scheduleAutoHide();
            }}
            style={styles.unlockButton}
          >
            <Ionicons color="#FFFFFF" name="lock-open-outline" size={22} />
            <Text style={styles.unlockText}>Unlock</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  player: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  topBarButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  videoTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 14,
  },
  centerControls: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(0,0,0,0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: 'rgba(0,0,0,0.54)',
  },
  slider: {
    width: '100%',
    height: 30,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
    marginBottom: 12,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionLabel: {
    color: '#C8C8C8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  actionLabelDisabled: {
    color: '#6A6A6A',
  },
  primaryTransportButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  utilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '42%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  utilityChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    maxWidth: 110,
  },
  secondaryButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonActive: {
    borderWidth: 1,
    borderColor: '#E53935',
  },
  subtitleMeta: {
    color: '#AFAFAF',
    fontSize: 12,
    marginTop: 10,
  },
  subtitleWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 110,
    alignItems: 'center',
  },
  subtitleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  subtitleTextSmall: {
    fontSize: 14,
    lineHeight: 22,
  },
  subtitleTextLarge: {
    fontSize: 22,
    lineHeight: 32,
  },
  subtitleTextYellow: {
    color: '#FFD54F',
  },
  subtitleTextNoBackground: {
    backgroundColor: 'transparent',
  },
  indicatorCard: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    minWidth: 148,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  indicatorValue: {
    color: '#E53935',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  doubleTapBadge: {
    position: 'absolute',
    top: '40%',
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  doubleTapLeft: {
    left: 24,
  },
  doubleTapRight: {
    right: 24,
  },
  doubleTapText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  bufferingState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 54 : 72,
    alignSelf: 'center',
    backgroundColor: 'rgba(229,57,53,0.92)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 30,
    backgroundColor: 'transparent',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  unlockText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
});
