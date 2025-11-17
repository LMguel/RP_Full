import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

// Telas de autenticação
import LoginModeScreen from '../screens/LoginModeScreen';
import EmpresaLoginScreen from '../screens/EmpresaLoginScreen';
import FuncionarioLoginScreen from '../screens/FuncionarioLoginScreen';

// Telas principais
import CameraRegistroScreen from '../screens/CameraRegistroScreen';

const Stack = createNativeStackNavigator();

export default function Routes() {
  const { signed, loading } = useAuth();

  console.log('[ROUTES] Loading:', loading, 'Signed:', signed);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {signed ? (
          // Usuário logado - mostrar câmera
          <Stack.Screen name="CameraRegistro" component={CameraRegistroScreen} />
        ) : (
          // Usuário não logado - fluxo de login
          <>
            <Stack.Screen name="LoginMode" component={LoginModeScreen} />
            <Stack.Screen name="EmpresaLogin" component={EmpresaLoginScreen} />
            <Stack.Screen name="FuncionarioLogin" component={FuncionarioLoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
