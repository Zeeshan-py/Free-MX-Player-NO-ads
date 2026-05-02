import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function SubtitleLoader() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Subtitle loader placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  text: {
    color: '#B3B3B3',
    fontSize: 14,
  },
});
