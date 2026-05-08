import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorBoundary from './src/components/ErrorBoundary';
import withErrorBoundary from './src/components/withErrorBoundary';
import { league } from './src/engine/LeagueEngine';
import { StorageService } from './src/services/StorageService';
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
import PlayoffPictureScreen from './src/screens/PlayoffPictureScreen';
import PlayoffBracketScreen from './src/screens/PlayoffBracketScreen';
import GamePlanScreen from './src/screens/GamePlanScreen';
import InjuryReportScreen from './src/screens/InjuryReportScreen';
import TeamStatsScreen from './src/screens/TeamStatsScreen';
import ContractScreen from './src/screens/ContractScreen';
import PracticeSquadScreen from './src/screens/PracticeSquadScreen';
import TrainingScreen from './src/screens/TrainingScreen';

const Stack = createNativeStackNavigator();

const wrappedScreens = {
  Home: withErrorBoundary(HomeScreen),
  TeamDetail: withErrorBoundary(TeamDetailScreen),
  Season: withErrorBoundary(SeasonScreen),
  Match: withErrorBoundary(MatchScreen),
  Draft: withErrorBoundary(DraftScreen),
  BoxScore: withErrorBoundary(BoxScoreScreen),
  News: withErrorBoundary(NewsScreen),
  Leaderboard: withErrorBoundary(LeaderboardScreen),
  FreeAgency: withErrorBoundary(FreeAgencyScreen),
  Trade: withErrorBoundary(TradeScreen),
  Awards: withErrorBoundary(AwardsScreen),
  SeasonRecap: withErrorBoundary(SeasonRecapScreen),
  Compare: withErrorBoundary(CompareScreen),
  Coach: withErrorBoundary(CoachScreen),
  Franchise: withErrorBoundary(FranchiseScreen),
  SalaryCap: withErrorBoundary(SalaryCapScreen),
  Roster: withErrorBoundary(RosterScreen),
  Schedule: withErrorBoundary(ScheduleScreen),
  Settings: withErrorBoundary(SettingsScreen),
  PlayoffPicture: withErrorBoundary(PlayoffPictureScreen),
  PlayoffBracket: withErrorBoundary(PlayoffBracketScreen),
  GamePlan: withErrorBoundary(GamePlanScreen),
  InjuryReport: withErrorBoundary(InjuryReportScreen),
  TeamStats: withErrorBoundary(TeamStatsScreen),
  Contracts: withErrorBoundary(ContractScreen),
  PracticeSquad: withErrorBoundary(PracticeSquadScreen),
  Training: withErrorBoundary(TrainingScreen),
};

const fullscreenRoutes = [
  'News',
  'Leaderboard',
  'FreeAgency',
  'Trade',
  'Awards',
  'SeasonRecap',
  'Compare',
  'Coach',
  'Franchise',
  'SalaryCap',
  'Roster',
  'Schedule',
  'Settings',
  'PlayoffPicture',
  'PlayoffBracket',
  'GamePlan',
  'InjuryReport',
  'TeamStats',
  'Contracts',
  'PracticeSquad',
  'Training',
];

export default function App() {
  useEffect(() => {
    const saveCurrentSlot = () => {
      if (league.userTeamId && league.slotId) {
        void StorageService.saveCurrentGame();
      }
    };

    if (typeof window === 'undefined' || !window.addEventListener) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveCurrentSlot();
    };

    window.addEventListener('pagehide', saveCurrentSlot);
    window.addEventListener('beforeunload', saveCurrentSlot);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', saveCurrentSlot);
      window.removeEventListener('beforeunload', saveCurrentSlot);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#1a1a1a',
            headerTitleStyle: { fontWeight: 'bold' },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="Home"
            component={wrappedScreens.Home}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TeamDetail"
            component={wrappedScreens.TeamDetail}
            options={{
              title: 'Team Roster',
              headerTransparent: true,
              headerTintColor: '#fff',
              headerTitle: '',
            }}
          />
          <Stack.Screen
            name="Season"
            component={wrappedScreens.Season}
            options={{
              title: 'Season Mode',
              headerTransparent: true,
              headerTintColor: '#fff',
              headerTitle: '',
            }}
          />
          <Stack.Screen
            name="Match"
            component={wrappedScreens.Match}
            options={{
              title: 'Game Day',
              headerStyle: { backgroundColor: '#000' },
              headerTintColor: '#fff',
            }}
          />

          {fullscreenRoutes.map((route) => (
            <Stack.Screen
              key={route}
              name={route}
              component={wrappedScreens[route]}
              options={{ headerShown: false }}
            />
          ))}

          <Stack.Screen
            name="Draft"
            component={wrappedScreens.Draft}
            options={{
              title: 'Offseason Draft',
              headerStyle: { backgroundColor: '#1e272e' },
              headerTintColor: '#feca57',
              headerLeft: null,
            }}
          />
          <Stack.Screen
            name="BoxScore"
            component={wrappedScreens.BoxScore}
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
