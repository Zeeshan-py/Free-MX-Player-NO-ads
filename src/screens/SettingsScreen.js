import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

import { useSettings } from '../hooks/useSettings';

const ALLOWED_EXTENSIONS = new Set(['mp4', 'mkv', 'avi', 'mov', 'flv', '3gp']);
const THUMBNAIL_CACHE_DIR = `${FileSystem.cacheDirectory}myplayer-thumbnails`;

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SUBTITLE_SIZE_OPTIONS = ['Small', 'Medium', 'Large'];
const SUBTITLE_COLOR_OPTIONS = ['White', 'Yellow'];
const SUBTITLE_BACKGROUND_OPTIONS = ['None', 'Semi-transparent'];
const SEEK_DURATION_OPTIONS = [5, 10, 15, 30];

function getFileExtension(filename = '') {
  const match = filename.toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : '';
}

async function scanVideoCount() {
  const permission = await MediaLibrary.requestPermissionsAsync(false, ['video']);

  if (!permission.granted) {
    return 0;
  }

  let after;
  let hasNextPage = true;
  let count = 0;

  while (hasNextPage) {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.video],
      first: 100,
      after,
    });

    count += page.assets.filter((asset) => ALLOWED_EXTENSIONS.has(getFileExtension(asset.filename))).length;
    hasNextPage = page.hasNextPage;
    after = page.endCursor;
  }

  return count;
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SectionCard({ children }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

function Row({ label, value, children, onPress }) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowTextBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.rowPressed]}>
      {content}
    </Pressable>
  );
}

function ToggleRow({ label, value, onValueChange }) {
  return (
    <Row label={label}>
      <Switch
        ios_backgroundColor="#2A2A2A"
        onValueChange={onValueChange}
        thumbColor="#FFFFFF"
        trackColor={{ false: '#333333', true: '#E53935' }}
        value={value}
      />
    </Row>
  );
}

function ChoiceRow({ expandedKey, itemKey, label, options, selectedValue, onSelect, valueFormatter }) {
  const isExpanded = expandedKey === itemKey;
  const formattedValue = valueFormatter ? valueFormatter(selectedValue) : String(selectedValue);

  return (
    <View>
      <Row label={label} onPress={onSelect.toggle} value={formattedValue}>
        <Text style={styles.expandIndicator}>{isExpanded ? '-' : '+'}</Text>
      </Row>

      {isExpanded ? (
        <View style={styles.choiceWrap}>
          {options.map((option) => {
            const optionKey = String(option);
            const isActive = option === selectedValue;
            const optionLabel = valueFormatter ? valueFormatter(option) : optionKey;

            return (
              <Pressable
                key={optionKey}
                onPress={() => onSelect.pick(option)}
                style={({ pressed }) => [
                  styles.choiceChip,
                  isActive && styles.choiceChipActive,
                  pressed && styles.choiceChipPressed,
                ]}
              >
                <Text style={[styles.choiceChipText, isActive && styles.choiceChipTextActive]}>
                  {optionLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function ActionButtonRow({ label, buttonLabel, onPress, disabled }) {
  return (
    <Row label={label}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.actionButton,
          disabled && styles.actionButtonDisabled,
          pressed && !disabled && styles.actionButtonPressed,
        ]}
      >
        <Text style={styles.actionButtonText}>{buttonLabel}</Text>
      </Pressable>
    </Row>
  );
}

export default function SettingsScreen({ navigation }) {
  const { settings, isLoading, updateSetting } = useSettings();
  const [expandedKey, setExpandedKey] = useState(null);
  const [videoCount, setVideoCount] = useState(0);
  const [isRescanning, setIsRescanning] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Settings',
      headerBackTitleVisible: false,
    });
  }, [navigation]);

  const refreshVideoCount = useCallback(async () => {
    setIsRescanning(true);

    try {
      const count = await scanVideoCount();
      setVideoCount(count);
    } catch {
      Alert.alert('Scan failed', 'Unable to rescan the media library right now.');
    } finally {
      setIsRescanning(false);
    }
  }, []);

  useEffect(() => {
    refreshVideoCount();
  }, [refreshVideoCount]);

  const clearThumbnailCache = useCallback(async () => {
    setIsClearingCache(true);

    try {
      await FileSystem.deleteAsync(THUMBNAIL_CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(THUMBNAIL_CACHE_DIR, { intermediates: true });
      Alert.alert('Cache cleared', 'Thumbnail cache has been cleared.');
    } catch {
      Alert.alert('Cache error', 'Unable to clear thumbnail cache right now.');
    } finally {
      setIsClearingCache(false);
    }
  }, []);

  const makeChoiceHandlers = useCallback(
    (key) => ({
      toggle: () => setExpandedKey((current) => (current === key ? null : key)),
      pick: (value) => {
        updateSetting(key, value);
        setExpandedKey(null);
      },
    }),
    [updateSetting]
  );

  const speedFormatter = useCallback((value) => `${value}x`, []);
  const seekFormatter = useCallback((value) => `${value}s`, []);

  const settingsContent = useMemo(
    () => (
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <SectionHeader title="PLAYER SETTINGS" />
        <SectionCard>
          <ChoiceRow
            expandedKey={expandedKey}
            itemKey="defaultPlaybackSpeed"
            label="Default playback speed"
            onSelect={makeChoiceHandlers('defaultPlaybackSpeed')}
            options={SPEED_OPTIONS}
            selectedValue={settings.defaultPlaybackSpeed}
            valueFormatter={speedFormatter}
          />
          <ToggleRow
            label="Auto-play next video"
            onValueChange={(value) => updateSetting('autoplayNextVideo', value)}
            value={settings.autoplayNextVideo}
          />
          <ToggleRow
            label="Resume playback from where I left off"
            onValueChange={(value) => updateSetting('resumePlayback', value)}
            value={settings.resumePlayback}
          />
          <ToggleRow
            label="Hardware acceleration"
            onValueChange={(value) => updateSetting('hardwareAcceleration', value)}
            value={settings.hardwareAcceleration}
          />
        </SectionCard>

        <SectionHeader title="SUBTITLE SETTINGS" />
        <SectionCard>
          <ChoiceRow
            expandedKey={expandedKey}
            itemKey="subtitleTextSize"
            label="Subtitle text size"
            onSelect={makeChoiceHandlers('subtitleTextSize')}
            options={SUBTITLE_SIZE_OPTIONS}
            selectedValue={settings.subtitleTextSize}
          />
          <ChoiceRow
            expandedKey={expandedKey}
            itemKey="subtitleTextColor"
            label="Subtitle text color"
            onSelect={makeChoiceHandlers('subtitleTextColor')}
            options={SUBTITLE_COLOR_OPTIONS}
            selectedValue={settings.subtitleTextColor}
          />
          <ChoiceRow
            expandedKey={expandedKey}
            itemKey="subtitleBackground"
            label="Subtitle background"
            onSelect={makeChoiceHandlers('subtitleBackground')}
            options={SUBTITLE_BACKGROUND_OPTIONS}
            selectedValue={settings.subtitleBackground}
          />
        </SectionCard>

        <SectionHeader title="GESTURE SETTINGS" />
        <SectionCard>
          <ToggleRow
            label="Enable volume gesture"
            onValueChange={(value) => updateSetting('enableVolumeGesture', value)}
            value={settings.enableVolumeGesture}
          />
          <ToggleRow
            label="Enable brightness gesture"
            onValueChange={(value) => updateSetting('enableBrightnessGesture', value)}
            value={settings.enableBrightnessGesture}
          />
          <ToggleRow
            label="Enable double tap seek"
            onValueChange={(value) => updateSetting('enableDoubleTapSeek', value)}
            value={settings.enableDoubleTapSeek}
          />
          <ChoiceRow
            expandedKey={expandedKey}
            itemKey="seekDuration"
            label="Seek duration"
            onSelect={makeChoiceHandlers('seekDuration')}
            options={SEEK_DURATION_OPTIONS}
            selectedValue={settings.seekDuration}
            valueFormatter={seekFormatter}
          />
        </SectionCard>

        <SectionHeader title="STORAGE" />
        <SectionCard>
          <ActionButtonRow
            buttonLabel={isRescanning ? 'Scanning...' : 'Rescan'}
            disabled={isRescanning}
            label="Rescan media library"
            onPress={refreshVideoCount}
          />
          <Row label="Total videos found" value={isRescanning ? 'Scanning...' : String(videoCount)} />
          <ActionButtonRow
            buttonLabel={isClearingCache ? 'Clearing...' : 'Clear'}
            disabled={isClearingCache}
            label="Clear thumbnails cache"
            onPress={clearThumbnailCache}
          />
        </SectionCard>

        <SectionHeader title="ABOUT" />
        <SectionCard>
          <Row label="App name" value="MyPlayer" />
          <Row label="Version" value="1.0.0" />
          <View style={styles.aboutBlock}>
            <Text style={styles.aboutText}>No ads. No tracking. Just your videos.</Text>
          </View>
        </SectionCard>
      </ScrollView>
    ),
    [
      clearThumbnailCache,
      expandedKey,
      isClearingCache,
      isRescanning,
      makeChoiceHandlers,
      refreshVideoCount,
      seekFormatter,
      settings.autoplayNextVideo,
      settings.defaultPlaybackSpeed,
      settings.enableBrightnessGesture,
      settings.enableDoubleTapSeek,
      settings.enableVolumeGesture,
      settings.hardwareAcceleration,
      settings.resumePlayback,
      settings.seekDuration,
      settings.subtitleBackground,
      settings.subtitleTextColor,
      settings.subtitleTextSize,
      speedFormatter,
      updateSetting,
      videoCount,
    ]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color="#E53935" size="large" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return <View style={styles.container}>{settingsContent}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  loadingState: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  sectionHeader: {
    color: '#E53935',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222222',
    overflow: 'hidden',
    marginBottom: 16,
  },
  row: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowPressed: {
    backgroundColor: '#1B1B1B',
  },
  rowTextBlock: {
    flex: 1,
    paddingRight: 14,
  },
  rowLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  rowValue: {
    color: '#9C9C9C',
    fontSize: 13,
    marginTop: 4,
  },
  expandIndicator: {
    color: '#E53935',
    fontSize: 22,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -4,
  },
  choiceChip: {
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    marginTop: 8,
  },
  choiceChipPressed: {
    opacity: 0.88,
  },
  choiceChipActive: {
    backgroundColor: 'rgba(229,57,53,0.14)',
    borderColor: '#E53935',
  },
  choiceChipText: {
    color: '#CFCFCF',
    fontSize: 13,
    fontWeight: '600',
  },
  choiceChipTextActive: {
    color: '#FFFFFF',
  },
  actionButton: {
    backgroundColor: '#E53935',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonPressed: {
    opacity: 0.86,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  aboutBlock: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  aboutText: {
    color: '#B8B8B8',
    fontSize: 14,
    lineHeight: 22,
  },
});
