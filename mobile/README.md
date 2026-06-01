# REGISTRA.PONTO — Terminal Android Kiosk

Aplicativo React Native de terminal de ponto eletrônico **offline-first** com reconhecimento facial **REAL** on-device (MobileFaceNet TFLite + MLKit Face Detection) e fallback AWS Rekognition. Modo kiosk Android para tablets corporativos (Samsung Galaxy Tab A11 4GB Android).

## 1. Arquitetura

```
mobile/
├─ assets/models/
│   ├─ mobilefacenet.tflite     # ⚠ adicionar manualmente (ver assets/models/README.md)
│   └─ README.md
├─ src/
│  ├─ api/                      # Axios + interceptors + endpoints
│  ├─ app/                      # App raiz, bootstrap, theme, queryClient
│  ├─ components/               # PrimaryButton, TextField, Clock, StatusBar
│  ├─ database/                 # SQLite + migrations versionadas
│  ├─ features/
│  │   ├─ auth/                 # LoginScreen, ProvisioningScreen, authStore
│  │   ├─ facial/               # ⭐ Reconhecimento facial REAL
│  │   │   ├─ useLiveRecognition.ts      # frame processor + worklet
│  │   │   ├─ providers/tfliteProvider   # MobileFaceNet (fast-tflite)
│  │   │   ├─ embeddingCache.ts          # cache em memória
│  │   │   ├─ embeddingPullService.ts    # sync de embeddings
│  │   │   ├─ embeddingService.ts        # interface JS
│  │   │   ├─ faceRecognitionService.ts  # JS + cloud fallback
│  │   │   ├─ antiSpoofing.ts            # blink + movimento + size
│  │   │   ├─ preprocessing.ts           # math worklet-safe
│  │   │   ├─ faceMath.ts                # top-K, gap, decisão
│  │   │   ├─ calibrationLog.ts          # ring buffer p/ debug
│  │   │   ├─ FacialScanScreen.tsx       # tela live
│  │   │   └─ CalibrationScreen.tsx      # ajuste threshold + métricas
│  │   ├─ kiosk/                # KioskScreen, KioskService, kioskStore
│  │   ├─ records/              # RecordService (cria ponto offline-first)
│  │   ├─ sync/                 # syncStore
│  │   └─ settings/             # SettingsScreen, configStore
│  ├─ navigation/               # RootNavigator com gating por sessão
│  ├─ repositories/             # employee, embedding, timeRecord, syncQueue, deviceConfig, log
│  ├─ services/                 # bootstrap, connectivity, deviceId, sync, queueProcessor
│  ├─ storage/                  # mmkv, secureStorage (Keychain)
│  ├─ types/                    # domain, api, navigation
│  └─ utils/                    # config, logger, time, id
└─ android/
   └─ app/src/main/java/com/registraponto/
       ├─ MainActivity.java
       ├─ MainApplication.java
       └─ kiosk/
           ├─ KioskModule.java
           ├─ KioskPackage.java
           ├─ RPDeviceAdminReceiver.java
           └─ RPBootReceiver.java
```

## 2. Pipeline facial REAL (offline)

### Live recognition (hot path — frame processor / worklet)

```
camera frame (vision-camera, pixelFormat: yuv, fps: 20)
   │
   ├─▶ useFaceDetector (MLKit, classification: all)
   │     ├─ leftEyeOpenProbability / rightEyeOpenProbability  (anti-spoof)
   │     ├─ yawAngle / pitchAngle / rollAngle                (anti-spoof)
   │     └─ bounds { x, y, width, height }
   │
   ├─▶ Anti-spoofing (antiSpoofing.ts)
   │     ├─ minFaceSizeRatio (face/frame width ≥ 22%)
   │     ├─ minConfidence
   │     ├─ blink detection (open → closed → open janela 4s)
   │     └─ movimento facial (variância yaw/pitch ≥ 4°)
   │
   ├─▶ expandBbox(face, +30%) → crop quadrado dentro do frame
   │
   ├─▶ vision-camera-resize-plugin
   │     resize(frame, { crop, scale: 112x112, pixelFormat: 'rgb', dataType: 'uint8' })
   │
   ├─▶ MobileFaceNet TFLite (react-native-fast-tflite, runSync no worklet)
   │     input: [1, 112, 112, 3] uint8
   │     output: [1, 192] float32
   │
   ├─▶ L2-normalize embedding (in-place)
   │
   ├─▶ cosine similarity vs EmbeddingCache (Float32Array em memória)
   │     calcula best + second melhor → gap
   │
   └─▶ decisão:
         best ≥ threshold E gap ≥ topGap  → MATCH (RecordService.createPunch)
         best < threshold                  → NO_MATCH (BELOW_THRESHOLD)
         gap < topGap                      → AMBIGUOUS → fallback cloud
         cache vazio                        → EMPTY_CACHE → fallback cloud

cooldown global: faceCooldownMs (default 1500ms)
```

Performance no Tab A11 4GB:
- detecção MLKit: 10-25ms/frame
- crop+resize plugin: 1-3ms
- MFN runSync 112x112: 25-60ms (CPU XNNPACK)
- match (≤500 embeddings): <1ms
- **Total typical**: 40-90ms (sub-100ms na maioria dos rostos)

### Decisão multi-fator (anti falso-positivo)

| Caso | Resultado |
|---|---|
| `best ≥ 0.62` E `gap ≥ 0.05` | ✅ ACEITA |
| `best ≥ 0.62` E `gap < 0.05` | ⚠ AMBIGUOUS → cloud fallback |
| `best < 0.62` | ❌ NO_MATCH |
| `cache.size === 0` | ⚠ EMPTY_CACHE → cloud fallback |

Threshold default `0.62` é um valor seguro para MobileFaceNet 192d com L2-normalização — **calibre via CalibrationScreen** para o seu dataset real.

## 3. Como o app obtém embeddings

**Não** computa embeddings de fotos no aparelho (decodificação JPEG → tensor é lenta e exige bridge nativo). A arquitetura prevê:

1. **Backend** computa embeddings ao cadastrar funcionário (Lambda + TFLite ou TensorFlow lambda layer)
2. **Mobile** pulla via `GET /api/v2/face_embeddings?since=ISO&model_version=mobilefacenet@112x112-192d`
3. Pull incremental — `since` é o `updated_at` máximo recebido. Itens com `deleted: true` removem do cache.

Endpoint a implementar no Flask backend:

```python
@routes.route('/api/v2/face_embeddings', methods=['GET'])
@token_required
def list_embeddings(payload):
    company_id = payload.get('company_id')
    since = request.args.get('since')
    model_version = request.args.get('model_version')

    items = []
    # query DynamoDB tabela FaceEmbeddings WHERE company_id=? AND updated_at > since
    # ...

    return jsonify({
        'items': items,           # [{employee_id, embedding: [192 floats], model_version, updated_at, deleted?}]
        'server_now': iso_now(),
        'model_version': 'mobilefacenet@112x112-192d',
    })
```

Pull é enfileirado a cada 10min via `EMBEDDING_PULL` na sync_queue, e também executado manualmente via `Settings → Calibração → Sincronizar embeddings agora`.

## 4. Sync engine (existente, agora com EMBEDDING_PULL)

```
SyncService.tick() roda por:
  - intervalo (config.syncIntervalMs default 60s)
  - listener NetInfo (offline → online)
  - BackgroundFetch headless (15min)
  - SyncService.kick(reason) manual

A cada tick:
  - se passou ≥ 10min do último pull facial → enfileira EMBEDDING_PULL
  - QueueProcessor.runBatch() processa items prontos
      TIME_RECORD_CREATE   → POST /api/registrar_ponto_facial (idempotente via client_id)
      EMPLOYEE_PULL        → GET /api/funcionarios → upsert
      EMBEDDING_PULL       → GET /api/v2/face_embeddings?since=… → upsert cache
  - falhas: backoff exponencial, persistido em sync_queue
```

## 5. Anti-spoofing leve

Sem modelos pesados — apenas heurísticas:

- **Tamanho mínimo do rosto**: `face.width / frame.width ≥ 22%` (configurável)
- **Confiança mínima do detector** MLKit
- **Blink detection**: monitorando `leftEyeOpenProbability + rightEyeOpenProbability`, exige sequência `aberto (≥0.7) → fechado (≤0.3) → aberto` em janela de 4 segundos
- **Movimento facial**: variância de `yawAngle` ou `pitchAngle` ≥ 4° na janela — diferencia rosto vivo de foto estática

Anti-spoofing pode ser desligado em `Calibration` para enrollment / debug.

## 6. Calibração (CalibrationScreen)

Acessível em `Settings → Calibração avançada`. Permite:
- Ver estado do modelo (carregado/erro/versão)
- Ver tamanho do cache de embeddings
- **Sincronizar embeddings agora** (pull manual)
- Ajustar em runtime: threshold, gap, tamanho mínimo, confiança, cooldown
- Liga/desliga anti-spoofing e fallback cloud
- Liga/desliga **logging de calibração** — cada decisão do hot path entra em um ring buffer com:
  - duração da inferência (ms)
  - top-K matches com nome resolvido
  - decisão (ACCEPT/REJECT_THRESHOLD/REJECT_GAP/REJECT_SPOOF/NO_FACE/ERROR)
  - threshold, gap, faceSizeRatio
- Botão "Testar reconhecimento" abre câmera com logging ativo

## 7. Banco local SQLite (inalterado)

| Tabela | Função |
|---|---|
| `employees` | Funcionários (snapshot do backend) |
| `face_embeddings` | Embeddings 192d L2-normalizados (JSON) com `model_version` |
| `time_records` | Registros de ponto. `synced=0` ⇒ pendente. `client_id` único |
| `sync_queue` | Operações pendentes (TIME_RECORD_CREATE, EMPLOYEE_PULL, EMBEDDING_PULL) |
| `device_config` | Config remota da empresa para este device |
| `logs` | Logs persistidos via logger.info/warn/error |

**Invalidação automática de embeddings**: ao boot, se a versão do modelo do app não bate com a versão dos embeddings salvos, são removidos e re-pullados.

## 8. Modo Kiosk Android

Inalterado da v1:
- `KioskModule.java` (bridge: startLockTask, setBootStartEnabled, setKeepAwake, isDeviceOwner)
- `RPDeviceAdminReceiver` + `device_admin.xml`
- `RPBootReceiver` reabre app no `BOOT_COMPLETED`
- Manifest: `lockTaskMode="if_whitelisted"` + categorias HOME/LAUNCHER

Para kiosk completo (sem barra de status / multitarefa), o tablet precisa ser **Device Owner**:
```bash
adb shell dpm set-device-owner com.registraponto/.kiosk.RPDeviceAdminReceiver
```

## 9. Permissões Android

Manifest já configurado:

| Permissão | Uso |
|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | API + NetInfo |
| `CAMERA` + `<uses-feature camera.front required>` | Reconhecimento facial |
| `RECEIVE_BOOT_COMPLETED` | Auto-start no boot |
| `WAKE_LOCK`, `DISABLE_KEYGUARD` | Tablet ligado |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` | Sync persistente |
| `BIND_DEVICE_ADMIN` | Kiosk Device Owner |
| `READ_MEDIA_IMAGES` | Upload de frames se necessário |
| `VIBRATE` | Feedback de leitura |
| `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM` | BackgroundFetch |

## 10. Setup local

> Requer Node 18+, JDK 17, Android SDK 34, NDK 26.

```bash
cd mobile
npm install

# Configurar API
cp .env.example .env
# editar API_BASE_URL para o backend Flask

# ⚠ Adicionar o modelo MobileFaceNet
# Coloque mobilefacenet.tflite em assets/models/ — ver assets/models/README.md

# Rodar
npm run android

# Release
npm run android:release
# ./android/app/build/outputs/apk/release/app-release.apk
```

### Credenciais de teste
- Usuário: `teste`
- Senha: `123123`

### Verificação no log
```
[INFO] [TFLite] Modelo carregado (hook). inputs=[[1,112,112,3]] outputs=[[1,192]]
[INFO] [EmbeddingCache] Hidratado com N embeddings
[INFO] [FacialScan] MATCH live id=… sim=0.78 gap=0.21 dur=68ms record=…
```

## 11. Segurança

- ✅ Tokens em Keychain (SecureStorage)
- ✅ MMKV criptografado para cache
- ✅ Embeddings só (sem fotos brutas guardadas no aparelho)
- ✅ TLS-only na rede (`network_security_config`)
- ✅ JWT validado com 401 → logout automático
- ✅ Modelo binário no APK (não baixado em runtime)

## 12. Performance no Tab A11 (otimizações ativas)

- `pixelFormat: 'yuv'` na câmera (menor banda que RGB)
- `fps: 20` na câmera (suficiente para reconhecimento, economiza CPU)
- Frame processor com `cooldownMs` global — nunca processa mais de 1 inferência/cooldown
- Cache de embeddings como `Float32Array` (não `number[]`) — 4x menor footprint, melhor cache de CPU
- Snapshot do cache passado por referência ao worklet (sem cópia por frame)
- Resize plugin faz crop+scale numa única operação nativa
- Inferência TFLite é `runSync` no worklet thread (não bloqueia UI/JS)
- Embeddings vêm pré-computados do backend — nunca decodificamos JPEG no aparelho

## 13. Próximos passos

1. **Implementar `/api/v2/face_embeddings` no backend Flask** — sem isso, mobile não terá embeddings para matching local. Fallback Rekognition continua funcionando.
2. **Pipeline de enrollment server-side**: quando funcionário é cadastrado com foto, lambda computa MFN 192d e armazena.
3. **GPU delegate / NNAPI** para ainda mais velocidade — `react-native-fast-tflite` suporta via `delegate: 'gpu'` ou `delegate: 'android-nnapi'`. Tablet A11 não tem GPU forte — NNAPI provavelmente é melhor.
4. **Frame processor com `useSkia`** para overlay visual (caixa do rosto detectada em tempo real).
5. **Re-enrollment via mobile**: tela admin para capturar nova foto do funcionário no próprio terminal.

## 14. Observações

- **NÃO commitar** `.env`, `*.keystore`, `local.properties`, `assets/models/*.tflite`
- **NÃO usar Expo Go** — exige código nativo
- O `EmbeddingCache` é singleton em memória — limpo ao logout (queue + DB são preservados, mas o cache é re-hidratado).
- O hot path do reconhecimento NÃO usa `EmbeddingService.match()` — usa diretamente `cosineSim` no worklet. `EmbeddingService` é só para JS-side (tela de calibração, fallback ad-hoc).
