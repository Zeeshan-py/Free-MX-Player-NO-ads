import { useCallback, useState } from 'react';

export default function useMediaLibrary() {
  const [videos, setVideos] = useState([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const refreshLibrary = useCallback(async () => {
    setIsLoading(true);

    try {
      setVideos([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    videos,
    hasPermission,
    isLoading,
    setHasPermission,
    refreshLibrary,
  };
}
