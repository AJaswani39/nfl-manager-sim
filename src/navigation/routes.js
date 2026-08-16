import HomeScreen from '../screens/HomeScreen';
import TeamDetailScreen from '../screens/TeamDetailScreen';
import SeasonScreen from '../screens/SeasonScreen';
import MatchScreen from '../screens/MatchScreen';
import DraftScreen from '../screens/DraftScreen';
import BoxScoreScreen from '../screens/BoxScoreScreen';
import NewsScreen from '../screens/NewsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import FreeAgencyScreen from '../screens/FreeAgencyScreen';
import TradeScreen from '../screens/TradeScreen';
import AwardsScreen from '../screens/AwardsScreen';
import SeasonRecapScreen from '../screens/SeasonRecapScreen';
import CompareScreen from '../screens/CompareScreen';
import CoachScreen from '../screens/CoachScreen';
import FranchiseScreen from '../screens/FranchiseScreen';
import SalaryCapScreen from '../screens/SalaryCapScreen';
import RosterScreen from '../screens/RosterScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PlayoffPictureScreen from '../screens/PlayoffPictureScreen';
import PlayoffBracketScreen from '../screens/PlayoffBracketScreen';
import GamePlanScreen from '../screens/GamePlanScreen';
import InjuryReportScreen from '../screens/InjuryReportScreen';
import TeamStatsScreen from '../screens/TeamStatsScreen';
import ContractScreen from '../screens/ContractScreen';
import PracticeSquadScreen from '../screens/PracticeSquadScreen';
import TrainingScreen from '../screens/TrainingScreen';

// Single source of truth for navigator routes. `fullscreen: true` screens hide the
// header. The custom-configured screens (TeamDetail/Season/Match/Draft/BoxScore)
// carry their own header options.
export const ROUTES = [
  { name: 'Home', screen: HomeScreen, options: { headerShown: false } },
  { name: 'TeamDetail', screen: TeamDetailScreen, options: { title: 'Team Roster', headerTransparent: true, headerTintColor: '#fff', headerTitle: '' } },
  { name: 'Season', screen: SeasonScreen, options: { title: 'Season Mode', headerTransparent: true, headerTintColor: '#fff', headerTitle: '' } },
  { name: 'Match', screen: MatchScreen, options: { title: 'Game Day', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' } },
  { name: 'Draft', screen: DraftScreen, options: { title: 'Offseason Draft', headerStyle: { backgroundColor: '#1e272e' }, headerTintColor: '#feca57', headerLeft: null } },
  { name: 'BoxScore', screen: BoxScoreScreen, options: { title: 'Post Game Stats', headerStyle: { backgroundColor: '#1e1e1e' }, headerTintColor: '#fff', headerLeft: null } },
  { name: 'News', screen: NewsScreen, fullscreen: true },
  { name: 'Leaderboard', screen: LeaderboardScreen, fullscreen: true },
  { name: 'FreeAgency', screen: FreeAgencyScreen, fullscreen: true },
  { name: 'Trade', screen: TradeScreen, fullscreen: true },
  { name: 'Awards', screen: AwardsScreen, fullscreen: true },
  { name: 'SeasonRecap', screen: SeasonRecapScreen, fullscreen: true },
  { name: 'Compare', screen: CompareScreen, fullscreen: true },
  { name: 'Coach', screen: CoachScreen, fullscreen: true },
  { name: 'Franchise', screen: FranchiseScreen, fullscreen: true },
  { name: 'SalaryCap', screen: SalaryCapScreen, fullscreen: true },
  { name: 'Roster', screen: RosterScreen, fullscreen: true },
  { name: 'Schedule', screen: ScheduleScreen, fullscreen: true },
  { name: 'Settings', screen: SettingsScreen, fullscreen: true },
  { name: 'PlayoffPicture', screen: PlayoffPictureScreen, fullscreen: true },
  { name: 'PlayoffBracket', screen: PlayoffBracketScreen, fullscreen: true },
  { name: 'GamePlan', screen: GamePlanScreen, fullscreen: true },
  { name: 'InjuryReport', screen: InjuryReportScreen, fullscreen: true },
  { name: 'TeamStats', screen: TeamStatsScreen, fullscreen: true },
  { name: 'Contracts', screen: ContractScreen, fullscreen: true },
  { name: 'PracticeSquad', screen: PracticeSquadScreen, fullscreen: true },
  { name: 'Training', screen: TrainingScreen, fullscreen: true },
];
