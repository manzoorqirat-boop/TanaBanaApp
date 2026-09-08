import 'react-native-gesture-handler'; // must be the first import
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initI18n } from './src/i18n';
import { colors } from './src/theme/tokens';
import type i18nType from 'i18next';

export default function App() {
  const [i18nInstance, setI18nInstance] = useState<typeof i18nType | null>(null);

  useEffect(() => {
    initI18n().then(setI18nInstance);
  }, []);

  if (!i18nInstance) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18nInstance}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
