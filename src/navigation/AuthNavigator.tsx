import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import ActivateAccountScreen from '../screens/auth/ActivateAccountScreen';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  // No more `token` — reset is OTP-code-based now, not a deep-linked
  // token, so this only ever carries the email to pre-fill (optional,
  // e.g. if someone navigates here directly rather than via
  // ForgotPassword).
  ResetPassword: { email?: string } | undefined;
  ActivateAccount: { email?: string } | undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** Replaces the web app's unauthenticated routes ("/", "/forgot-password", "/reset-password"). */
export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="ActivateAccount" component={ActivateAccountScreen} />
    </Stack.Navigator>
  );
}
