import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** Replaces the web app's unauthenticated routes ("/", "/forgot-password", "/reset-password"). */
export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}
