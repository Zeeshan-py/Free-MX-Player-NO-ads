import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PlayerControls() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Player controls placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
