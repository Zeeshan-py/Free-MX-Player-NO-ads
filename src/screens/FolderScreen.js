import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import VideoCard, { VIDEO_CARD_ITEM_HEIGHT } from '../components/VideoCard';

const SORT_OPTIONS = [
  { key: 'name', label: 'Name A-Z' },
  { key: 'date', label: 'Date' },
  { key: 'size', label: 'Size' },
];

function sortVideos(videos, sortBy) {
  const items = [...videos];

  switch (sortBy) {
    case 'name':
      return items.sort((a, b) => (a.title || a.filename || '').localeCompare(b.title || b.filename || ''));
    case 'size':
      return items.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
    case 'date':
    default:
      return items.sort((a, b) => (b.modificationTime || 0) - (a.modificationTime || 0));
  }
}

function HeaderActionButton({ iconName, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.headerButton}>
      <Ionicons color="#FFFFFF" name={iconName} size={22} />
    </Pressable>
  );
}

export default function FolderScreen({ navigation, route }) {
  const folderName = route.params?.folderName || 'Folder';
  const folderPath = route.params?.folderPath || '';
  const [videos, setVideos] = useState(route.params?.videos || []);
  const [sortBy, setSortBy] = useState('date');
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: folderName,
      headerTitleAlign: 'left',
      headerBackTitleVisible: false,
      headerRight: () => (
        <HeaderActionButton
          iconName="swap-vertical-outline"
          onPress={() => setIsSortMenuVisible((current) => !current)}
        />
      ),
    });
  }, [folderName, navigation]);

  const sortedVideos = useMemo(() => sortVideos(videos, sortBy), [sortBy, videos]);

  const openPlayer = useCallback(
    (video) => {
      const selectedIndex = sortedVideos.findIndex((item) => item.id === video.id);

      navigation.navigate('Player', {
        videoUri: video.uri,
        videoList: sortedVideos,
        currentIndex: selectedIndex >= 0 ? selectedIndex : 0,
        currentVideo: video,
      });
    },
    [navigation, sortedVideos]
  );

  const handleDeleteFromList = useCallback((video) => {
    setVideos((current) => current.filter((item) => item.id !== video.id));
  }, []);

  const handleInfo = useCallback(
    (video) => {
      Alert.alert(
        video?.title || video?.filename || 'Video info',
        [`Folder: ${folderName}`, folderPath ? `Path: ${folderPath}` : null].filter(Boolean).join('\n')
      );
    },
    [folderName, folderPath]
  );

  const renderVideoCard = useCallback(
    ({ item }) => (
      <VideoCard
        onDeleteFromList={handleDeleteFromList}
        onInfo={handleInfo}
        onPress={() => openPlayer(item)}
        video={item}
      />
    ),
    [handleDeleteFromList, handleInfo, openPlayer]
  );

  return (
    <View style={styles.container}>
      {isSortMenuVisible ? (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => {
                setSortBy(option.key);
                setIsSortMenuVisible(false);
              }}
              style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === option.key && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.key ? (
                <Ionicons color="#E53935" name="checkmark" size={18} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={sortedVideos}
        getItemLayout={(_, index) => ({
          length: VIDEO_CARD_ITEM_HEIGHT,
          offset: VIDEO_CARD_ITEM_HEIGHT * index,
          index,
        })}
        initialNumToRender={8}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons color="#E53935" name="folder-open-outline" size={52} />
            <Text style={styles.emptyTitle}>No videos in this folder</Text>
            <Text style={styles.emptySubtitle}>Videos from {folderName} will appear here.</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.folderTitle}>{folderName}</Text>
            <Text style={styles.folderCount}>{videos.length} videos</Text>
            {folderPath ? (
              <Text numberOfLines={1} style={styles.folderPath}>
                {folderPath}
              </Text>
            ) : null}
          </View>
        }
        removeClippedSubviews
        renderItem={renderVideoCard}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortMenu: {
    position: 'absolute',
    top: 10,
    right: 16,
    zIndex: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 8,
    width: 180,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sortOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortOptionPressed: {
    backgroundColor: '#202020',
  },
  sortOptionText: {
    color: '#D8D8D8',
    fontSize: 14,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  headerBlock: {
    marginBottom: 12,
  },
  folderTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  folderCount: {
    color: '#A7A7A7',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  folderPath: {
    color: '#6F6F6F',
    fontSize: 12,
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#A7A7A7',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
