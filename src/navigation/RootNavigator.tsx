import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { linking } from './linking';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator();

/**
 * Replaces App.tsx's <Protected>/<LoginGate> route-guard logic. Rather
 * than guarding individual routes, we swap the entire navigator tree —
 * simpler in RN since there's no "redirect" concept mid-stack the way
 * react-router's <Navigate> works.
 */
export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="App" component={AppNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
