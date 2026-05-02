import { useState } from 'react';

export default function useVideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  return {
    isPlaying,
    position,
    duration,
    setIsPlaying,
    setPosition,
    setDuration,
  };
}
