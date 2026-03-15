// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { GameProvider } from './src/context/GameContext';
import MenuMusicManager from './src/components/MenuMusicManager';
import { Component } from 'react';
import {
  useFonts,
  Cinzel_400Regular,
  Cinzel_700Bold,
} from '@expo-google-fonts/cinzel';
import {
  EBGaramond_400Regular,
  EBGaramond_500Medium,
} from '@expo-google-fonts/eb-garamond';
import {
  CrimsonPro_400Regular,
  CrimsonPro_600SemiBold,
} from '@expo-google-fonts/crimson-pro';
import MainMenuScreen from './src/screens/MainMenuScreen';

class AudioErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
import CampaignSelectScreen from './src/screens/CampaignSelectScreen';
import CharacterCreationScreen from './src/screens/CharacterCreationScreen';
import DMConversationScreen from './src/screens/DMConversationScreen';

const Stack = createStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_700Bold,
    EBGaramond_400Regular,
    EBGaramond_500Medium,
    CrimsonPro_400Regular,
    CrimsonPro_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <GameProvider>
      <AudioErrorBoundary><MenuMusicManager /></AudioErrorBoundary>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="MainMenu"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#0D0B07' },
            cardStyleInterpolator: ({ current, layouts }) => ({
              cardStyle: {
                transform: [{
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                }],
                opacity: current.progress.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.8, 1],
                }),
              },
            }),
          }}
        >
          <Stack.Screen name="MainMenu" component={MainMenuScreen} />
          <Stack.Screen name="CampaignSelect" component={CampaignSelectScreen} />
          <Stack.Screen name="CharacterCreation" component={CharacterCreationScreen} />
          <Stack.Screen name="DMConversation" component={DMConversationScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GameProvider>
  );
}
