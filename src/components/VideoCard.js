import React, { memo, useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import formatTime from '../utils/formatTime';

export const VIDEO_CARD_ITEM_HEIGHT = 94;

function ThumbnailPreview({ uri }) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, 0);

    return () => clearTimeout(timer);
  }, [uri]);

  if (!uri || !shouldLoad) {
    return (
      <View style={[styles.thumbnail, styles.thumbnailFallback]}>
        <Ionicons color="#8A8A8A" name="play-circle" size={28} />
      </View>
    );
  }

  return <Image source={{ uri, cache: 'force-cache' }} style={styles.thumbnail} />;
}

function VideoCard({
  video,
  onPress,
  onDeleteFromList,
  onInfo,
}) {
  const fileName = video?.title || video?.filename?.replace(/\.[^/.]+$/, '') || 'Unknown Video';
  const duration = formatTime(video?.duration || 0);
  const fileSize = typeof video?.fileSize === 'string'
    ? video.fileSize
    : `${(((video?.sizeBytes || 0) / (1024 * 1024)) || 0).toFixed(1)} MB`;
  const folderName = video?.folderName || 'Unknown Folder';
  const thumbnailUri = video?.thumbnailCacheUri || video?.thumbnail || video?.thumbnailUri || null;

  const handleInfo = useCallback(() => {
    if (onInfo) {
      onInfo(video);
      return;
    }

    Alert.alert(
      fileName,
      [`Duration: ${duration}`, `Size: ${fileSize}`, `Folder: ${folderName}`].join('\n')
    );
  }, [duration, fileName, fileSize, folderName, onInfo, video]);

  const openMenu = useCallback(() => {
    Alert.alert('Video options', fileName, [
      {
        text: 'Play',
        onPress,
      },
      {
        text: 'Delete from list',
        onPress: () => onDeleteFromList?.(video),
        style: 'destructive',
      },
      {
        text: 'Info',
        onPress: handleInfo,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  }, [fileName, handleInfo, onDeleteFromList, onPress, video]);

  return (
    <Pressable
      android_ripple={{ color: '#252525' }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumbnailWrapper}>
        <ThumbnailPreview uri={thumbnailUri} />

        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{duration}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.title}>
          {fileName}
        </Text>

        <Text style={styles.metaText}>{fileSize}</Text>

        <View style={styles.folderRow}>
          <MaterialIcons color="#8F8F8F" name="folder" size={15} />
          <Text numberOfLines={1} style={styles.folderText}>
            {folderName}
          </Text>
        </View>
      </View>

      <Pressable
        hitSlop={10}
        onPress={openMenu}
        style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
      >
        <Ionicons color="#D7D7D7" name="ellipsis-vertical" size={18} />
      </Pressable>
    </Pressable>
  );
}

function areEqual(prevProps, nextProps) {
  return (
    prevProps.onPress === nextProps.onPress &&
    prevProps.onDeleteFromList === nextProps.onDeleteFromList &&
    prevProps.onInfo === nextProps.onInfo &&
    prevProps.video?.id === nextProps.video?.id &&
    prevProps.video?.thumbnailCacheUri === nextProps.video?.thumbnailCacheUri &&
    prevProps.video?.thumbnail === nextProps.video?.thumbnail &&
    prevProps.video?.thumbnailUri === nextProps.video?.thumbnailUri &&
    prevProps.video?.title === nextProps.video?.title &&
    prevProps.video?.filename === nextProps.video?.filename &&
    prevProps.video?.duration === nextProps.video?.duration &&
    prevProps.video?.fileSize === nextProps.video?.fileSize &&
    prevProps.video?.sizeBytes === nextProps.video?.sizeBytes &&
    prevProps.video?.folderName === nextProps.video?.folderName
  );
}

export default memo(VideoCard, areEqual);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cardPressed: {
    opacity: 0.9,
  },
  thumbnailWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#3A3A3A',
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#E53935',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  metaText: {
    color: '#8F8F8F',
    fontSize: 12,
    marginBottom: 6,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderText: {
    flex: 1,
    color: '#8F8F8F',
    fontSize: 12,
    marginLeft: 6,
  },
  menuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  menuButtonPressed: {
    backgroundColor: '#242424',
  },
});
