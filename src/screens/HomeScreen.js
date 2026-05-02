import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import VideoCard from '../components/VideoCard';
import formatTime from '../utils/formatTime';

const ALLOWED_EXTENSIONS = new Set(['mp4', 'mkv', 'avi', 'mov', 'flv', '3gp']);
const SORT_OPTIONS = [
  { key: 'name', label: 'Name A-Z' },
  { key: 'date', label: 'Date' },
  { key: 'size', label: 'Size' },
  { key: 'duration', label: 'Duration' },
];

function stripExtension(filename = '') {
  return filename.replace(/\.[^/.]+$/, '');
}

function getFileExtension(filename = '') {
  const match = filename.toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : '';
}

function getFolderNameFromUri(uri = '') {
  const sanitizedUri = decodeURIComponent(uri).replace('file://', '').split('?')[0];
  const segments = sanitizedUri.split('/').filter(Boolean);

  if (segments.length < 2) {
    return 'Unknown Folder';
  }

  return segments[segments.length - 2];
}

function formatSizeInMb(bytes = 0) {
  if (!bytes || bytes < 0) {
    return '0.0 MB';
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sortVideos(videos, sortBy) {
  const items = [...videos];

  switch (sortBy) {
    case 'name':
      return items.sort((a, b) => a.title.localeCompare(b.title));
    case 'size':
      return items.sort((a, b) => b.sizeBytes - a.sizeBytes);
    case 'duration':
      return items.sort((a, b) => b.duration - a.duration);
    case 'date':
    default:
      return items.sort((a, b) => b.modificationTime - a.modificationTime);
  }
}

async function buildVideoItem(asset) {
  const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
  const localUri = assetInfo.localUri || asset.uri || '';
  let sizeBytes = 0;

  if (localUri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri, { size: true });
      sizeBytes = fileInfo.exists && typeof fileInfo.size === 'number' ? fileInfo.size : 0;
    } catch {
      sizeBytes = 0;
    }
  }

  return {
    id: asset.id,
    assetId: asset.id,
    uri: localUri || asset.uri,
    thumbnailUri: localUri || asset.uri,
    filename: asset.filename,
    title: stripExtension(asset.filename),
    duration: asset.duration || 0,
    sizeBytes,
    folderName: getFolderNameFromUri(localUri || asset.uri),
    creationTime: asset.creationTime || 0,
    modificationTime: asset.modificationTime || 0,
  };
}

function HeaderActionButton({ iconName, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.headerButton}>
      <Ionicons color="#FFFFFF" name={iconName} size={22} />
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const toggleSearch = useCallback(() => {
    setIsSearchVisible((current) => !current);
    setIsSortMenuVisible(false);
  }, []);

  const toggleSortMenu = useCallback(() => {
    setIsSortMenuVisible((current) => !current);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'MyPlayer',
      headerTitleAlign: 'left',
      headerRight: () => (
        <View style={styles.headerActions}>
          <HeaderActionButton iconName="search-outline" onPress={toggleSearch} />
          <HeaderActionButton iconName="swap-vertical-outline" onPress={toggleSortMenu} />
        </View>
      ),
    });
  }, [navigation, toggleSearch, toggleSortMenu]);

  const scanVideos = useCallback(async () => {
    setIsLoading(true);
    setPermissionDenied(false);
    setErrorMessage('');
    setIsSortMenuVisible(false);

    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['video']);

      if (!permission.granted) {
        setVideos([]);
        setPermissionDenied(true);
        return;
      }

      let after;
      let hasNextPage = true;
      const collectedVideos = [];

      while (hasNextPage) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: [MediaLibrary.MediaType.video],
          first: 100,
          after,
        });

        const supportedAssets = page.assets.filter((asset) =>
          ALLOWED_EXTENSIONS.has(getFileExtension(asset.filename))
        );

        const mappedVideos = await Promise.all(supportedAssets.map(buildVideoItem));
        collectedVideos.push(...mappedVideos);

        hasNextPage = page.hasNextPage;
        after = page.endCursor;
      }

      setVideos(collectedVideos);
    } catch (error) {
      setVideos([]);
      setErrorMessage('Unable to scan your video library right now.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    scanVideos();
  }, [scanVideos]);

  const sortedVideos = useMemo(() => sortVideos(videos, sortBy), [sortBy, videos]);

  const filteredVideos = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedVideos;
    }

    return sortedVideos.filter((video) => video.title.toLowerCase().includes(normalizedQuery));
  }, [searchQuery, sortedVideos]);

  const folders = useMemo(() => {
    const folderMap = new Map();

    videos.forEach((video) => {
      const existingFolder = folderMap.get(video.folderName);

      if (existingFolder) {
        existingFolder.count += 1;
        return;
      }

      folderMap.set(video.folderName, {
        name: video.folderName,
        count: 1,
      });
    });

    return Array.from(folderMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [videos]);

  const openPlayer = useCallback(
    (video) => {
      navigation.navigate('Player', {
        videoUri: video.uri,
        currentVideo: video,
        videos: filteredVideos,
        initialIndex: filteredVideos.findIndex((item) => item.id === video.id),
      });
    },
    [filteredVideos, navigation]
  );

  const openFolder = useCallback(
    (folderName) => {
      const folderVideos = videos.filter((video) => video.folderName === folderName);

      navigation.navigate('Folders', {
        folderName,
        videos: folderVideos,
      });
    },
    [navigation, videos]
  );

  const renderVideoCard = useCallback(
    ({ item }) => (
      <VideoCard
        duration={formatTime(item.duration)}
        folderName={item.folderName}
        onPress={() => openPlayer(item)}
        size={formatSizeInMb(item.sizeBytes)}
        thumbnailUri={item.thumbnailUri}
        title={item.title}
      />
    ),
    [openPlayer]
  );

  const listHeader = (
    <View style={styles.listHeader}>
      <Text style={styles.countText}>{videos.length} Videos Found</Text>
      {searchQuery ? <Text style={styles.searchMetaText}>{filteredVideos.length} matches</Text> : null}

      {isSearchVisible ? (
        <View style={styles.searchContainer}>
          <Ionicons color="#8E8E8E" name="search-outline" size={18} />
          <TextInput
            onChangeText={setSearchQuery}
            placeholder="Search videos..."
            placeholderTextColor="#7A7A7A"
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons color="#BDBDBD" name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Folders</Text>
        <Text style={styles.sectionMeta}>{folders.length} folders</Text>
      </View>

      {folders.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.folderScrollerContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {folders.map((folder) => (
            <Pressable
              key={folder.name}
              onPress={() => openFolder(folder.name)}
              style={({ pressed }) => [styles.folderChip, pressed && styles.folderChipPressed]}
            >
              <MaterialIcons color="#E53935" name="folder" size={18} />
              <View style={styles.folderChipTextWrap}>
                <Text numberOfLines={1} style={styles.folderChipTitle}>
                  {folder.name}
                </Text>
                <Text style={styles.folderChipMeta}>{folder.count} videos</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.folderEmptyState}>
          <Text style={styles.folderEmptyText}>No folders available yet.</Text>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator color="#E53935" size="large" />
        <Text style={styles.loadingTitle}>Scanning your videos...</Text>
        <Text style={styles.loadingSubtitle}>Looking through device storage for supported files.</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.centeredState}>
        <MaterialIcons color="#E53935" name="folder-off" size={54} />
        <Text style={styles.emptyTitle}>Storage permission is required</Text>
        <Text style={styles.emptySubtitle}>
          Allow MyPlayer to access your videos so we can scan and list them here.
        </Text>
        <Pressable onPress={scanVideos} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredState}>
        <MaterialIcons color="#E53935" name="error-outline" size={54} />
        <Text style={styles.emptyTitle}>Couldn&apos;t load videos</Text>
        <Text style={styles.emptySubtitle}>{errorMessage}</Text>
        <Pressable onPress={scanVideos} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

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
        data={filteredVideos}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyListState}>
            <Ionicons color="#E53935" name="videocam-off-outline" size={54} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching videos' : 'No videos found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term or clear the search.'
                : 'Supported files will appear here after they are detected on your device.'}
            </Text>
          </View>
        }
        ListHeaderComponent={listHeader}
        renderItem={renderVideoCard}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  centeredState: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
  loadingSubtitle: {
    color: '#A5A5A5',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
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
    maxWidth: 320,
  },
  primaryButton: {
    backgroundColor: '#E53935',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  sortMenu: {
    position: 'absolute',
    top: 10,
    right: 16,
    zIndex: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 8,
    width: 188,
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
  listHeader: {
    marginBottom: 12,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  searchMetaText: {
    color: '#8F8F8F',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#272727',
    paddingHorizontal: 14,
    marginBottom: 18,
    minHeight: 50,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
  },
  clearButton: {
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionMeta: {
    color: '#8F8F8F',
    fontSize: 13,
    fontWeight: '500',
  },
  folderScrollerContent: {
    paddingBottom: 6,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 12,
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#232323',
  },
  folderChipPressed: {
    opacity: 0.92,
  },
  folderChipTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  folderChipTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  folderChipMeta: {
    color: '#989898',
    fontSize: 12,
    marginTop: 2,
  },
  folderEmptyState: {
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  folderEmptyText: {
    color: '#8C8C8C',
    fontSize: 13,
  },
  emptyListState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 54,
    paddingHorizontal: 20,
  },
});
