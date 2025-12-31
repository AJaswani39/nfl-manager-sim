import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import TeamDetailScreen from './src/screens/TeamDetailScreen';

import SeasonScreen from './src/screens/SeasonScreen';

import MatchScreen from './src/screens/MatchScreen';
import DraftScreen from './src/screens/DraftScreen';
import BoxScoreScreen from './src/screens/BoxScoreScreen';
import NewsScreen from './src/screens/NewsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import FreeAgencyScreen from './src/screens/FreeAgencyScreen';
import TradeScreen from './src/screens/TradeScreen';
import AwardsScreen from './src/screens/AwardsScreen';
import SeasonRecapScreen from './src/screens/SeasonRecapScreen';
import CompareScreen from './src/screens/CompareScreen';
import CoachScreen from './src/screens/CoachScreen';
import FranchiseScreen from './src/screens/FranchiseScreen';
import SalaryCapScreen from './src/screens/SalaryCapScreen';

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
        <Stack.Screen 
          name="News" 
          component={NewsScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Leaderboard" 
          component={LeaderboardScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="FreeAgency" 
          component={FreeAgencyScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Trade" 
          component={TradeScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Awards" 
          component={AwardsScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="SeasonRecap" 
          component={SeasonRecapScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Compare" 
          component={CompareScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Coach" 
          component={CoachScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Franchise" 
          component={FranchiseScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="SalaryCap" 
          component={SalaryCapScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Draft" 
          component={DraftScreen} 
          options={{ 
            title: 'Offseason Draft',
            headerStyle: { backgroundColor: '#1e272e' },
            headerTintColor: '#feca57',
            headerLeft: null, // Prevent going back during draft
          }}
        />
        <Stack.Screen 
          name="BoxScore" 
          component={BoxScoreScreen} 
          options={{ 
            title: 'Post Game Stats',
            headerStyle: { backgroundColor: '#1e1e1e' },
            headerTintColor: '#fff',
            headerLeft: null, 
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
