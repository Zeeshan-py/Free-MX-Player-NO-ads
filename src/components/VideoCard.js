import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export default function VideoCard({
  thumbnailUri,
  title = 'Video Title',
  duration = '00:00',
  size = '0.0 MB',
  folderName = 'Unknown Folder',
  onPress,
}) {
  return (
    <Pressable
      android_ripple={{ color: '#252525' }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumbnailWrapper}>
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailFallback]}>
            <Ionicons color="#E53935" name="play-circle" size={30} />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{duration}</Text>
          <View style={styles.dot} />
          <Text style={styles.metaText}>{size}</Text>
        </View>

        <View style={styles.folderRow}>
          <MaterialIcons color="#E53935" name="folder" size={16} />
          <Text numberOfLines={1} style={styles.folderText}>
            {folderName}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.9,
  },
  thumbnailWrapper: {
    padding: 10,
  },
  thumbnail: {
    width: 110,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#121212',
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingRight: 14,
    paddingVertical: 14,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    color: '#B7B7B7',
    fontSize: 13,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#555555',
    marginHorizontal: 8,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderText: {
    flex: 1,
    color: '#D5D5D5',
    fontSize: 13,
    marginLeft: 6,
  },
});
