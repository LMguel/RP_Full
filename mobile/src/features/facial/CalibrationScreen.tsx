/**
 * CalibrationScreen - tela de debug e ajuste de threshold em runtime.
 *
 * Mostra:
 *  - métricas do hot path (similaridades, gaps, decisões)
 *  - estado do modelo + cache
 *  - sliders/inputs para ajustar thresholds (live)
 *  - botão de teste com a câmera
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@app/theme';
import { PrimaryButton } from '@components/PrimaryButton';
import { useConfigStore } from '@features/settings/configStore';
import { CalibrationLog, type CalibrationEvent } from './calibrationLog';
import { EmbeddingCache } from './embeddingCache';
import { EmployeeRepository } from '@repositories/employeeRepository';
import {
  TFLITE_MODEL_VERSION,
  getModelInstance,
  getModelLoadError,
} from './providers/tfliteProvider';
import { EmbeddingPullService } from './embeddingPullService';
import type { ScreenProps } from '@/types/navigation';

export function CalibrationScreen({ navigation }: ScreenProps<'Calibration'>) {
  const { config, update } = useConfigStore();

  const [events, setEvents] = useState<CalibrationEvent[]>([]);
  const [cacheSize, setCacheSize] = useState(EmbeddingCache.size());
  const [modelLoaded, setModelLoaded] = useState(getModelInstance() !== null);
  const [pullStatus, setPullStatus] = useState<string | null>(null);
  const [employeesByName, setEmployeesByName] = useState<
    Map<string, string>
  >(new Map());

  useEffect(() => {
    CalibrationLog.setEnabled(true);
    setEvents(CalibrationLog.list());
    return () => {
      if (!config.faceCalibrationLogging) CalibrationLog.setEnabled(false);
    };
  }, [config.faceCalibrationLogging]);

  useEffect(() => {
    const unsub = CalibrationLog.subscribe(() => {
      setEvents(CalibrationLog.list());
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    EmbeddingCache.hydrate().then(() => setCacheSize(EmbeddingCache.size()));
    const unsub = EmbeddingCache.subscribe(e => setCacheSize(e.size));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setModelLoaded(getModelInstance() !== null), 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const all = EmbeddingCache.snapshot();
        const m = new Map<string, string>();
        for (const e of all) {
          const emp = await EmployeeRepository.findById(e.employee_id);
          m.set(e.employee_id, emp?.nome ?? e.employee_id.slice(0, 8));
        }
        setEmployeesByName(m);
      } catch {
        // ignore
      }
    })();
  }, [cacheSize]);

  async function handlePullEmbeddings() {
    setPullStatus('Sincronizando…');
    try {
      const r = await EmbeddingPullService.pullIncremental();
      setPullStatus(`+${r.added} ·  -${r.removed} (cache: ${EmbeddingCache.size()})`);
    } catch (e) {
      setPullStatus(`Falha: ${(e as Error)?.message ?? 'erro'}`);
    }
  }

  const localModelEnabled =
    config.faceLocalModelEnabled && !!config.faceLocalModelPath?.trim();

  const modelStatus = !localModelEnabled
    ? 'Indisponível (local desativado)'
    : modelLoaded
    ? '✓ Carregado'
    : getModelLoadError()
    ? `✗ ${getModelLoadError()}`
    : 'Aguardando…';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Calibração facial</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modelo</Text>
          <Row label="Versão" value={TFLITE_MODEL_VERSION} small />
          <Row label="Estado" value={modelStatus} />
          <Row label="Cache" value={`${cacheSize} embedding${cacheSize === 1 ? '' : 's'}`} />
          {pullStatus ? <Row label="Pull" value={pullStatus} small /> : null}
          <PrimaryButton
            label="Sincronizar embeddings agora"
            onPress={handlePullEmbeddings}
            variant="ghost"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thresholds</Text>
          <NumField
            label="Similarity threshold (0-1)"
            value={config.faceSimilarityThreshold}
            onChange={v => update({ faceSimilarityThreshold: clamp(v, 0, 1) })}
            step={0.01}
          />
          <NumField
            label="Top-1 vs Top-2 gap mínimo"
            value={config.faceTopGap}
            onChange={v => update({ faceTopGap: clamp(v, 0, 1) })}
            step={0.01}
          />
          <NumField
            label="Tamanho mínimo (face/frame)"
            value={config.faceMinSizeRatio}
            onChange={v => update({ faceMinSizeRatio: clamp(v, 0.05, 0.9) })}
            step={0.01}
          />
          <NumField
            label="Confiança mínima detector"
            value={config.faceMinConfidence}
            onChange={v => update({ faceMinConfidence: clamp(v, 0, 1) })}
            step={0.05}
          />
          <NumField
            label="Cooldown (ms)"
            value={config.faceCooldownMs}
            onChange={v => update({ faceCooldownMs: Math.max(300, Math.floor(v)) })}
            step={100}
            integer
          />
          <RowSwitch
            label="Anti-spoofing (blink/movimento)"
            value={config.faceAntiSpoofEnabled}
            onChange={v => update({ faceAntiSpoofEnabled: v })}
          />
          <RowSwitch
            label="Fallback Rekognition"
            value={config.faceUseCloudFallback}
            onChange={v => update({ faceUseCloudFallback: v })}
          />
          <RowSwitch
            label="Logging detalhado (calibração)"
            value={config.faceCalibrationLogging}
            onChange={v => {
              update({ faceCalibrationLogging: v });
              CalibrationLog.setEnabled(v);
            }}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Últimas decisões ({events.length})</Text>
          <Pressable
            onPress={() => {
              CalibrationLog.clear();
              setEvents([]);
            }}
          >
            <Text style={styles.linkSmall}>Limpar</Text>
          </Pressable>
          {events.length === 0 ? (
            <Text style={styles.empty}>Aguardando eventos…</Text>
          ) : (
            events.map((e, i) => (
              <View key={`${e.ts}-${i}`} style={styles.eventRow}>
                <View style={styles.eventHead}>
                  <Text style={[styles.decision, decisionColor(e.decision)]}>
                    {e.decision}
                  </Text>
                  <Text style={styles.eventMeta}>{e.durationMs}ms</Text>
                </View>
                {e.topK.slice(0, 2).map((m, j) => (
                  <Text key={j} style={styles.topItem}>
                    #{j + 1}{' '}
                    {employeesByName.get(m.employee_id) ??
                      m.employee_id.slice(0, 8)}
                    : <Text style={styles.sim}>{(m.similarity * 100).toFixed(1)}%</Text>
                  </Text>
                ))}
                <Text style={styles.eventMetaSmall}>
                  th={e.threshold.toFixed(2)}
                  {e.gap !== undefined ? ` · gap=${(e.gap * 100).toFixed(1)}%` : ''}
                  {e.faceSizeRatio !== undefined
                    ? ` · size=${(e.faceSizeRatio * 100).toFixed(0)}%`
                    : ''}
                  {e.reason ? ` · ${e.reason}` : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        <PrimaryButton
          label="Testar reconhecimento"
          onPress={() => navigation.navigate('FacialScan')}
        />
        <PrimaryButton label="Voltar" onPress={() => navigation.goBack()} variant="ghost" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, small && { fontSize: 11 }]}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

function RowSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
  integer,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  integer?: boolean;
}) {
  const [text, setText] = useState(String(integer ? Math.round(value) : value));
  const lastValueRef = useRef(value);
  useEffect(() => {
    if (lastValueRef.current !== value) {
      setText(String(integer ? Math.round(value) : value));
      lastValueRef.current = value;
    }
  }, [value, integer]);

  return (
    <View style={styles.numRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.numCtrls}>
        <Pressable
          onPress={() => {
            const n = (integer ? Math.round(value - step) : value - step);
            onChange(n);
          }}
          style={styles.stepBtn}
        >
          <Text style={styles.stepTxt}>−</Text>
        </Pressable>
        <TextInput
          style={styles.numInput}
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          onEndEditing={() => {
            const n = parseFloat(text.replace(',', '.'));
            if (!isNaN(n)) onChange(integer ? Math.round(n) : n);
            else setText(String(value));
          }}
        />
        <Pressable
          onPress={() => {
            const n = integer ? Math.round(value + step) : value + step;
            onChange(n);
          }}
          style={styles.stepBtn}
        >
          <Text style={styles.stepTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function clamp(n: number, lo: number, hi: number) {
  if (isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function decisionColor(d: CalibrationEvent['decision']) {
  switch (d) {
    case 'ACCEPT':
      return { color: theme.colors.success };
    case 'REJECT_THRESHOLD':
    case 'REJECT_GAP':
    case 'REJECT_SPOOF':
      return { color: theme.colors.warn };
    case 'NO_FACE':
      return { color: theme.colors.textDim };
    case 'ERROR':
      return { color: theme.colors.danger };
    default:
      return { color: theme.colors.text };
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  title: { color: theme.colors.text, fontSize: 22, fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: { color: theme.colors.textDim, fontSize: 13, flex: 1 },
  rowValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
  },
  numRow: { gap: 6 },
  numCtrls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numInput: {
    flex: 1,
    height: 40,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.bgElevated,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  eventRow: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  eventHead: { flexDirection: 'row', justifyContent: 'space-between' },
  decision: { fontSize: 12, fontWeight: '700' },
  eventMeta: { color: theme.colors.textDim, fontSize: 11 },
  eventMetaSmall: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  topItem: { color: theme.colors.text, fontSize: 12, marginTop: 2 },
  sim: { color: theme.colors.accentBright, fontWeight: '600' },
  empty: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  linkSmall: { color: theme.colors.accentBright, fontSize: 12 },
});
