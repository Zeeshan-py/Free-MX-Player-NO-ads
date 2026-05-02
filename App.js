import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from './src/screens/HomeScreen';
import FolderScreen from './src/screens/FolderScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createStackNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0A0A0A',
    card: '#1A1A1A',
    text: '#FFFFFF',
    border: '#232323',
    primary: '#E53935',
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1A1A1A',
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontSize: 18,
              fontWeight: '600',
            },
            cardStyle: {
              backgroundColor: '#0A0A0A',
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'MyPlayer' }}
          />
          <Stack.Screen
            name="Folders"
            component={FolderScreen}
            options={{ title: 'Folders' }}
          />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{ title: 'Player' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
