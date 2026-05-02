import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function FolderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Folders</Text>
      <Text style={styles.subtitle}>Your local video folders will be listed here.</Text>
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
