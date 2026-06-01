/**
 * FacialScanScreen v2 — reconhecimento facial em tempo real.
 *
 * - Câmera frontal sempre ativa
 * - useLiveRecognition expõe um frame processor que detecta + reconhece
 * - JS lado: recebe LiveDecision, anima UI, chama RecordService no MATCH
 * - Cooldown global evita reentrada / duplicidades
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { theme } from '@app/theme';
import { useKioskStore } from '@features/kiosk/kioskStore';
import { useSyncStore } from '@features/sync/syncStore';
import { RecordService } from '@features/records/recordService';
import { EmployeeRepository } from '@repositories/employeeRepository';
import { logger } from '@utils/logger';
import {
  useLiveRecognition,
  type LiveDecision,
} from './useLiveRecognition';
import type { ScreenProps } from '@/types/navigation';

type Phase =
  | 'IDLE'
  | 'NO_FACE'
  | 'TOO_SMALL'
  | 'LIVENESS'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'NOT_RECOGNIZED'
  | 'ERROR';

interface UiState {
  phase: Phase;
  message: string;
  detail?: string;
  employeeName?: string;
}

const NAVIGATE_BACK_DELAY_MS = 1800;
const POST_DECISION_LOCK_MS = 1200;

export function FacialScanScreen({ navigation }: ScreenProps<'FacialScan'>) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);

  const setFlow = useKioskStore(s => s.setFlow);
  const setLastResult = useKioskStore(s => s.setLastResult);
  const setLastError = useKioskStore(s => s.setLastError);
  const isOnline = useSyncStore(s => s.isOnline);

  const [enabled, setEnabled] = useState(true);
  const [ui, setUi] = useState<UiState>({
    phase: 'NO_FACE',
    message: 'Posicione o rosto na moldura',
  });

  const lockedRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  function lockUi(state: UiState, navigateBack = false) {
    lockedRef.current = true;
    setUi(state);
    setEnabled(false);
    if (navigateBack) {
      setTimeout(() => navigation.replace('Kiosk'), NAVIGATE_BACK_DELAY_MS);
    } else {
      setTimeout(() => {
        lockedRef.current = false;
        setEnabled(true);
      }, POST_DECISION_LOCK_MS);
    }
  }

  async function onMatch(decision: Extract<LiveDecision, { kind: 'MATCH' }>) {
    if (lockedRef.current) return;
    try {
      const emp = await EmployeeRepository.findById(decision.employee_id);
      const name = emp?.nome ?? 'Funcionário';

      lockUi(
        {
          phase: 'CONFIRMED',
          message: 'Ponto registrado',
          detail: `${name} · sim ${(decision.similarity * 100).toFixed(1)}% · ${decision.durationMs}ms`,
          employeeName: name,
        },
        true,
      );

      const record = await RecordService.createPunch({
        employee_id: decision.employee_id,
        method: 'FACIAL',
        similarity: decision.similarity,
      });

      setLastResult(name, decision.similarity);
      setFlow('CONFIRMED');
      logger.info(
        'FacialScan',
        `MATCH live id=${decision.employee_id} sim=${decision.similarity.toFixed(3)} gap=${decision.gap.toFixed(3)} dur=${decision.durationMs}ms record=${record.id}`,
      );
    } catch (e) {
      logger.error('FacialScan', 'Falha ao registrar ponto pós-match', e);
      setLastError((e as Error)?.message ?? 'erro');
      lockUi({ phase: 'ERROR', message: 'Falha ao registrar ponto' }, false);
    }
  }

  async function tryCloudFallback(reason: string) {
    if (!isOnline) {
      lockUi(
        {
          phase: 'NOT_RECOGNIZED',
          message: 'Rosto não reconhecido',
          detail: 'Sem conexão para fallback. Tente novamente.',
        },
        false,
      );
      return;
    }
    if (!cameraRef.current) {
      lockedRef.current = false;
      return;
    }

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      const { FaceRecognitionService } = await import('./faceRecognitionService');
      const verdict = await FaceRecognitionService.cloudFallback(
        `file://${photo.path}`,
      );

      if (verdict.recognized && verdict.employee_id) {
        await onMatch({
          kind: 'MATCH',
          employee_id: verdict.employee_id,
          similarity: verdict.similarity ?? 0.95,
          gap: 1,
          durationMs: 0,
        });
        return;
      }

      lockUi(
        {
          phase: 'NOT_RECOGNIZED',
          message: 'Rosto não reconhecido',
          detail: `Local: ${reason} · Cloud: ${verdict.reason ?? 'falha'}`,
        },
        false,
      );
    } catch (e) {
      logger.warn('FacialScan', 'fallback cloud falhou', e);
      lockUi(
        { phase: 'NOT_RECOGNIZED', message: 'Rosto não reconhecido' },
        false,
      );
    }
  }

  const onDecision = useMemo(
    () => (d: LiveDecision) => {
      if (lockedRef.current) return;

      switch (d.kind) {
        case 'IDLE':
          return;
        case 'NO_FACE':
          setUi({
            phase: 'NO_FACE',
            message: 'Posicione o rosto na moldura',
          });
          setFlow('IDLE');
          return;
        case 'TOO_SMALL':
          setUi({
            phase: 'TOO_SMALL',
            message: 'Aproxime o rosto',
            detail: `Tamanho ${(d.sizeRatio * 100).toFixed(0)}%`,
          });
          return;
        case 'WAITING_LIVENESS':
          setUi({
            phase: 'LIVENESS',
            message: 'Pisque ou mova levemente o rosto',
            detail: d.reason,
          });
          setFlow('DETECTING');
          return;
        case 'PROCESSING':
          setUi({
            phase: 'PROCESSING',
            message: 'Reconhecendo…',
          });
          setFlow('MATCHING');
          return;
        case 'MATCH':
          void onMatch(d);
          return;
        case 'NO_MATCH':
          if (d.reason === 'AMBIGUOUS' || d.reason === 'EMPTY_CACHE') {
            lockedRef.current = true;
            setUi({
              phase: 'PROCESSING',
              message: 'Verificando na nuvem…',
            });
            void tryCloudFallback(d.reason);
            return;
          }
          lockUi(
            {
              phase: 'NOT_RECOGNIZED',
              message: 'Rosto não reconhecido',
              detail: `sim ${(d.topSimilarity * 100).toFixed(1)}%`,
            },
            false,
          );
          setFlow('NOT_RECOGNIZED');
          return;
        case 'ERROR':
          lockUi(
            { phase: 'ERROR', message: 'Falha técnica', detail: d.message },
            false,
          );
          setFlow('ERROR');
          return;
      }
    },
    [],
  );

  const { frameProcessor, modelState, modelError, cacheSize } =
    useLiveRecognition({
      enabled: enabled && hasPermission && !!device,
      onDecision,
    });

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.msg}>
          Permissão de câmera necessária para reconhecimento facial.
        </Text>
        <Pressable
          onPress={() =>
            requestPermission().then(ok => {
              if (!ok)
                Alert.alert(
                  'Permissão negada',
                  'Habilite a câmera nas configurações.',
                );
            })
          }
          style={styles.linkBtn}
        >
          <Text style={styles.linkTxt}>Conceder permissão</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.msg}>Procurando câmera frontal…</Text>
      </SafeAreaView>
    );
  }

  const modelStatusText =
    modelState === 'loaded'
      ? 'Modo híbrido (local + cloud)'
      : modelState === 'loading'
      ? 'Carregando modelo…'
      : modelState === 'unavailable'
      ? 'Modo cloud (Rekognition)'
      : 'Modelo com erro';

  const modelDetailText =
    modelState === 'error'
      ? `Erro: ${modelError ?? 'desconhecido'}`
      : null;

  const frameColor =
    ui.phase === 'CONFIRMED'
      ? theme.colors.success
      : ui.phase === 'NOT_RECOGNIZED' || ui.phase === 'ERROR'
      ? theme.colors.danger
      : ui.phase === 'PROCESSING'
      ? theme.colors.warn
      : theme.colors.accentBright;

  return (
    <View style={styles.fill}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        fps={15}
      />

      <View style={styles.overlay} pointerEvents="none">
        <View style={[styles.frame, { borderColor: frameColor }]} />
      </View>

      <SafeAreaView style={styles.controls} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={20}
            style={styles.backBtn}
          >
            <Text style={styles.backTxt}>← Voltar</Text>
          </Pressable>
          <View
            style={[
              styles.statusPill,
              ui.phase === 'CONFIRMED' && {
                backgroundColor: 'rgba(16,185,129,0.85)',
              },
              (ui.phase === 'NOT_RECOGNIZED' || ui.phase === 'ERROR') && {
                backgroundColor: 'rgba(239,68,68,0.85)',
              },
            ]}
          >
            <Text style={styles.statusTxt}>{ui.message}</Text>
            {ui.detail ? <Text style={styles.statusDetail}>{ui.detail}</Text> : null}
          </View>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.bottomMeta}>
          <Text style={styles.metaTxt}>
            {modelStatusText} · {cacheSize} embedding{cacheSize === 1 ? '' : 's'}
          </Text>
          {modelDetailText ? (
            <Text style={styles.metaWarn}>{modelDetailText}</Text>
          ) : null}
          {!isOnline ? (
            <Text style={styles.metaOffline}>Sem internet — modo offline</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 280,
    height: 360,
    borderRadius: 200,
    borderWidth: 3,
    borderColor: theme.colors.accentBright,
  },
  controls: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  backBtn: { padding: 8, minWidth: 64 },
  backTxt: { color: '#fff', fontSize: 16 },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: theme.radii.lg,
    minWidth: 200,
    alignItems: 'center',
  },
  statusTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statusDetail: { color: '#fff', fontSize: 11, marginTop: 2, opacity: 0.8 },
  bottomMeta: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  metaTxt: {
    color: '#fff',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
  },
  metaWarn: { color: theme.colors.warn, fontSize: 12, opacity: 0.95 },
  metaOffline: {
    color: theme.colors.warn,
    fontSize: 12,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  msg: { color: theme.colors.text, fontSize: 16, textAlign: 'center' },
  detail: { color: theme.colors.textDim, fontSize: 13, textAlign: 'center' },
  linkBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
  },
  linkTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
