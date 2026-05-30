import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

const VideoPlayerSurface = forwardRef(
  (
    {
      autoplay,
      onEnd,
      onError,
      onLoad,
      onPaused,
      onPlaying,
      onProgress,
      paused,
      rate = 1,
      resizeMode = 'contain',
      source,
      style,
      volume = 100,
    },
    ref
  ) => {
    const videoRef = useRef(null);

    useImperativeHandle(ref, () => ({
      seek(position) {
        const video = videoRef.current;

        if (!video || !Number.isFinite(video.duration)) {
          return;
        }

        video.currentTime = Math.max(0, Math.min(position, 1)) * video.duration;
      },
    }));

    useEffect(() => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      if (paused) {
        video.pause();
        return;
      }

      video.play().catch(() => undefined);
    }, [paused, source?.uri]);

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
      }
    }, [rate]);

    return (
      <View style={style}>
        <video
          ref={videoRef}
          autoPlay={autoplay}
          controls={false}
          onCanPlay={() => onPlaying?.({})}
          onEnded={() => onEnd?.()}
          onError={() => onError?.()}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            onLoad?.({
              duration: video.duration,
              currentTime: video.currentTime,
              remainingTime: Math.max(video.duration - video.currentTime, 0),
              position: 0,
            });
          }}
          onPause={() => onPaused?.()}
          onPlay={() => onPlaying?.({})}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            onProgress?.({
              duration: video.duration,
              currentTime: video.currentTime,
              remainingTime: Math.max(video.duration - video.currentTime, 0),
              position: video.duration ? video.currentTime / video.duration : 0,
            });
          }}
          src={source?.uri}
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: '#000000',
            height: '100%',
            objectFit: resizeMode === 'cover' ? 'cover' : 'contain',
            width: '100%',
          }}
          volume={Math.max(0, Math.min(volume / 100, 1))}
        />
      </View>
    );
  }
);

export default VideoPlayerSurface;
