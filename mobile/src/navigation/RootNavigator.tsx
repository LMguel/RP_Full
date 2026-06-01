import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types/navigation';

import { LoadingScreen } from '@features/auth/LoadingScreen';
import { LoginScreen } from '@features/auth/LoginScreen';
import { ProvisioningScreen } from '@features/auth/ProvisioningScreen';
import { KioskScreen } from '@features/kiosk/KioskScreen';
import { FacialScanScreen } from '@features/facial/FacialScanScreen';
import { SettingsScreen } from '@features/settings/SettingsScreen';
import { CalibrationScreen } from '@features/facial/CalibrationScreen';
import { useAuthStore } from '@features/auth/authStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isHydrated = useAuthStore(s => s.isHydrated);
  const session = useAuthStore(s => s.session);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#0B0F1A' },
      }}
    >
      {!isHydrated ? (
        <Stack.Screen name="Loading" component={LoadingScreen} />
      ) : !session ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Kiosk" component={KioskScreen} />
          <Stack.Screen name="FacialScan" component={FacialScanScreen} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="Calibration"
            component={CalibrationScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="Provisioning" component={ProvisioningScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
