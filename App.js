// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { GameProvider } from './src/context/GameContext';
import MainMenuScreen from './src/screens/MainMenuScreen';
import CampaignSelectScreen from './src/screens/CampaignSelectScreen';
import CharacterCreationScreen from './src/screens/CharacterCreationScreen';
import DMConversationScreen from './src/screens/DMConversationScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GameProvider>
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
