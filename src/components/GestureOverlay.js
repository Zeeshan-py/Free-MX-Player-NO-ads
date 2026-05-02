import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function GestureOverlay() {
  return (
    <View style={styles.overlay}>
      <Text style={styles.text}>Gesture overlay placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: {
    color: '#B3B3B3',
    fontSize: 14,
  },
});
