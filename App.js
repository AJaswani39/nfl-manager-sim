import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorBoundary from './src/components/ErrorBoundary';
import withErrorBoundary from './src/components/withErrorBoundary';
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
import RosterScreen from './src/screens/RosterScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PlayoffBracketScreen from './src/screens/PlayoffBracketScreen';
import GamePlanScreen from './src/screens/GamePlanScreen';
import InjuryReportScreen from './src/screens/InjuryReportScreen';
import TeamStatsScreen from './src/screens/TeamStatsScreen';
import ContractScreen from './src/screens/ContractScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <ErrorBoundary>
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
            component={withErrorBoundary(HomeScreen)}
            options={{ headerShown: false }} // We have a custom header in HomeScreen
          />
          <Stack.Screen
            name="TeamDetail"
            component={withErrorBoundary(TeamDetailScreen)}
            options={{
              title: 'Team Roster',
              headerTransparent: true,
              headerTintColor: '#fff',
              headerTitle: '', // Hide title as the custom header covers it
            }}
          />
          <Stack.Screen
            name="Season"
            component={withErrorBoundary(SeasonScreen)}
            options={{
              title: 'Season Mode',
              headerTransparent: true,
              headerTintColor: '#fff',
              headerTitle: '',
            }}
          />
          <Stack.Screen
            name="Match"
            component={withErrorBoundary(MatchScreen)}
            options={{
              title: 'Game Day',
              headerStyle: { backgroundColor: '#000' },
              headerTintColor: '#fff',
            }}
          />
          <Stack.Screen
            name="News"
            component={withErrorBoundary(NewsScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Leaderboard"
            component={withErrorBoundary(LeaderboardScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="FreeAgency"
            component={withErrorBoundary(FreeAgencyScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Trade"
            component={withErrorBoundary(TradeScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Awards"
            component={withErrorBoundary(AwardsScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SeasonRecap"
            component={withErrorBoundary(SeasonRecapScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Compare"
            component={withErrorBoundary(CompareScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Coach"
            component={withErrorBoundary(CoachScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Franchise"
            component={withErrorBoundary(FranchiseScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SalaryCap"
            component={withErrorBoundary(SalaryCapScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Roster"
            component={withErrorBoundary(RosterScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Schedule"
            component={withErrorBoundary(ScheduleScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Settings"
            component={withErrorBoundary(SettingsScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PlayoffBracket"
            component={withErrorBoundary(PlayoffBracketScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="GamePlan"
            component={withErrorBoundary(GamePlanScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="InjuryReport"
            component={withErrorBoundary(InjuryReportScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TeamStats"
            component={withErrorBoundary(TeamStatsScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Contracts"
            component={withErrorBoundary(ContractScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Draft"
            component={withErrorBoundary(DraftScreen)}
            options={{
              title: 'Offseason Draft',
              headerStyle: { backgroundColor: '#1e272e' },
              headerTintColor: '#feca57',
              headerLeft: null, // Prevent going back during draft
            }}
          />
          <Stack.Screen
            name="BoxScore"
            component={withErrorBoundary(BoxScoreScreen)}
            options={{
              title: 'Post Game Stats',
              headerStyle: { backgroundColor: '#1e1e1e' },
              headerTintColor: '#fff',
              headerLeft: null,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
