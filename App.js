import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import TeamDetailScreen from './src/screens/TeamDetailScreen';

import SeasonScreen from './src/screens/SeasonScreen';

import MatchScreen from './src/screens/MatchScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1a1a1a',
          headerTitleStyle: { fontWeight: 'bold' },
          headerShadowVisible: false, // Cleaner look
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ headerShown: false }} // We have a custom header in HomeScreen
        />
        <Stack.Screen 
          name="TeamDetail" 
          component={TeamDetailScreen} 
          options={{ 
            title: 'Team Roster',
            headerTransparent: true,
            headerTintColor: '#fff',
            headerTitle: '', // Hide title as the custom header covers it
          }}
        />
        <Stack.Screen 
          name="Season" 
          component={SeasonScreen} 
          options={{ 
            title: 'Season Mode',
            headerTransparent: true,
            headerTintColor: '#fff',
            headerTitle: '', 
          }}
        />
        <Stack.Screen 
          name="Match" 
          component={MatchScreen} 
          options={{ 
            title: 'Game Day',
            headerStyle: { backgroundColor: '#000' },
            headerTintColor: '#fff',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
