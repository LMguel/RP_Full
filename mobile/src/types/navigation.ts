import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Loading: undefined;
  Login: undefined;
  Provisioning: undefined;
  Kiosk: undefined;
  FacialScan: { employeeId?: string } | undefined;
  Settings: undefined;
  Calibration: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
