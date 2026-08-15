import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorBoundary from './src/components/ErrorBoundary';
import withErrorBoundary from './src/components/withErrorBoundary';
import { league } from './src/engine/LeagueEngine';
import { StorageService } from './src/services/StorageService';
import { ROUTES } from './src/navigation/routes';

const Stack = createNativeStackNavigator();

const screens = ROUTES.map((route) => ({
  name: route.name,
  component: withErrorBoundary(route.screen),
  options: route.fullscreen ? { headerShown: false } : route.options,
}));

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
          {screens.map(({ name, component, options }) => (
            <Stack.Screen key={name} name={name} component={component} options={options} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
