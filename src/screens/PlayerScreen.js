import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PlayerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Player</Text>
      <Text style={styles.subtitle}>VLC playback and gesture controls will be added here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: '#B3B3B3',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
