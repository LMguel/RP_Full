"""
ROTAS DE RECONHECIMENTO FACIAL — ISOLAMENTO MULTI-TENANT OBRIGATÓRIO

Regras invariantes deste módulo (não relaxar sem revisão de segurança):

1. O `company_id` é SEMPRE obtido do JWT (payload['company_id']). O frontend
   NUNCA dita qual empresa olhar.
2. O Rekognition retorna `ExternalImageId` no formato '<company_uuid>_<employee_id>'.
   A função `reconhecer_funcionario` já valida que o tenant casado bate com o
   tenant esperado e devolve TENANT_MISMATCH quando não bate.
3. Aqui no endpoint há uma segunda verificação defensiva (defense in depth)
   antes de qualquer leitura/escrita em DynamoDB.
4. Acesso ao DynamoDB usa SEMPRE chave composta (company_id + id) ou
   Query com KeyConditionExpression em company_id. NUNCA scan sem company_id,
   NUNCA fallback que olhe outras empresas.
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from decimal import Decimal
import pytz
import os
import uuid
import tempfile
from functools import wraps
from werkzeug.utils import secure_filename
from boto3.dynamodb.conditions import Key

from utils.auth import verify_token
from utils.aws import (
    reconhecer_funcionario,
    tabela_funcionarios,
    tabela_registros,
    tabela_configuracoes,
    generate_presigned_url,
    enviar_s3,
    rekognition,
    COLLECTION,
    _resize_for_rekognition,
)
from utils.geolocation import validar_localizacao, formatar_distancia

routes_facial = Blueprint('routes_facial', __name__)

TZ_SP = pytz.timezone('America/Sao_Paulo')


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return '', 200

        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401

        if token.startswith('Bearer '):
            token = token[7:]

        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido ou expirado'}), 401

        return f(payload, *args, **kwargs)
    return decorated


def _log_tenant_mismatch(*, endpoint, expected, matched, extra=None):
    """Log estruturado para auditoria. NUNCA suprima estes logs."""
    print(
        f"[FACIAL][AUDIT][TENANT_MISMATCH] endpoint={endpoint} "
        f"expected_company_id={expected} matched_company_id={matched} extra={extra}"
    )


def _buscar_funcionario_tenant_safe(company_id, employee_id):
    """get_item estrito (company_id + id). Retorna None se não existir.

    PROIBIDO trocar isto por scan. Se o item não existir nessa empresa,
    para os fluxos faciais o reconhecimento DEVE falhar — qualquer fallback
    quebraria o isolamento multi-tenant.
    """
    try:
        resp = tabela_funcionarios.get_item(
            Key={'company_id': company_id, 'id': employee_id}
        )
        return resp.get('Item')
    except Exception as e:
        print(f"[FACIAL] Erro em get_item Employees company_id={company_id} id={employee_id}: {e}")
        return None


def _registros_do_dia(company_id, employee_id, data_iso):
    """Query tenant-aware na tabela TimeRecords.

    HASH: company_id, RANGE: 'employee_id#date_time' (e.g. 'miguel_1234#2026-05-10 08:30:00').
    """
    try:
        resp = tabela_registros.query(
            KeyConditionExpression=(
                Key('company_id').eq(company_id)
                & Key('employee_id#date_time').begins_with(f"{employee_id}#{data_iso}")
            )
        )
        items = resp.get('Items', [])
        # Filtrar registros INVALIDADOS/AJUSTADOS
        items = [r for r in items if (r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')]
        # Ordenar por timestamp
        items.sort(key=lambda r: r.get('employee_id#date_time', ''))
        return items
    except Exception as e:
        print(f"[FACIAL] Erro em query TimeRecords company_id={company_id} employee_id={employee_id}: {e}")
        return []


@routes_facial.route('/api/reconhecer_rosto', methods=['POST', 'OPTIONS'])
@token_required
def reconhecer_rosto(payload):
    """Reconhece um rosto e devolve dados do funcionário SE — e somente se —
    o rosto pertencer à mesma empresa do JWT (kiosk autenticado).

    Qualquer match cuja ExternalImageId aponte para outra empresa é rejeitado
    e logado como TENANT_MISMATCH.
    """
    temp_path = None
    try:
        token_company_id = payload.get('company_id')
        if not token_company_id:
            return jsonify({
                'reconhecido': False,
                'error': 'Token sem company_id; faça login novamente.'
            }), 401

        if 'image' not in request.files:
            return jsonify({
                'reconhecido': False,
                'error': 'Nenhuma imagem enviada'
            }), 400

        file = request.files['image']
        if not file or file.filename == '':
            return jsonify({
                'reconhecido': False,
                'error': 'Nome de arquivo vazio'
            }), 400

        filename = secure_filename(f"temp_{uuid.uuid4().hex}.jpg")
        temp_path = os.path.join(tempfile.gettempdir(), filename)
        file.save(temp_path)
        print(f"[FACIAL] Recebida imagem ({os.path.getsize(temp_path)} bytes) para company_id={token_company_id}")

        # 1) Rekognition + validação de tenant (defesa #1, dentro do helper).
        match = reconhecer_funcionario(temp_path, expected_company_id=token_company_id)
        status = match.get('status') if isinstance(match, dict) else 'ERROR'

        if status == 'NO_MATCH':
            return jsonify({
                'reconhecido': False,
                'mensagem': 'Nenhum rosto correspondente encontrado'
            }), 200

        if status == 'NO_FACE':
            return jsonify({
                'reconhecido': False,
                'nenhumRostoDetectado': True,
                'mensagem': 'Nenhum rosto detectado na imagem'
            }), 200

        if status == 'INVALID_EXTERNAL_ID':
            # ExternalImageId fora do formato esperado. Não confiamos.
            _log_tenant_mismatch(
                endpoint='reconhecer_rosto',
                expected=token_company_id,
                matched=None,
                extra={'external_image_id': match.get('external_image_id')},
            )
            return jsonify({
                'reconhecido': False,
                'error': 'Cadastro facial inconsistente; contate o suporte.'
            }), 403

        if status == 'TENANT_MISMATCH':
            _log_tenant_mismatch(
                endpoint='reconhecer_rosto',
                expected=token_company_id,
                matched=match.get('matched_company_id'),
                extra={'external_image_id': match.get('external_image_id')},
            )
            # Resposta neutra para não revelar a outra empresa.
            return jsonify({
                'reconhecido': False,
                'error': 'Funcionário não pertence a esta empresa'
            }), 403

        if status not in ('OK', 'LOW_CONFIDENCE'):
            return jsonify({
                'reconhecido': False,
                'error': f"Erro no reconhecimento: {match.get('reason', status)}"
            }), 500

        baixa_confianca = status == 'LOW_CONFIDENCE'
        company_id = match['company_id']
        employee_id = match['employee_id']
        similarity = match.get('similarity', 0)

        if baixa_confianca:
            print(
                f"[FACIAL] Aceito com baixa confiança: company_id={token_company_id} "
                f"employee_id={employee_id} similarity={similarity:.2f}%"
            )

        # 2) Defesa #2: nunca confiar só no helper. Re-checar igualdade.
        if company_id != token_company_id:
            _log_tenant_mismatch(
                endpoint='reconhecer_rosto',
                expected=token_company_id,
                matched=company_id,
                extra={'where': 'post-helper-recheck'},
            )
            return jsonify({
                'reconhecido': False,
                'error': 'Funcionário não pertence a esta empresa'
            }), 403

        # 3) get_item ESTRITO: tem que existir nessa empresa. Sem fallback.
        funcionario = _buscar_funcionario_tenant_safe(token_company_id, employee_id)
        if not funcionario:
            print(
                f"[FACIAL] Match facial OK ({employee_id}) mas item não existe "
                f"em Employees(company_id={token_company_id}). Rejeitando."
            )
            return jsonify({
                'reconhecido': False,
                'error': 'Funcionário não encontrado nesta empresa'
            }), 404

        # 4) Funcionário precisa estar ativo.
        is_active = funcionario.get('is_active', funcionario.get('ativo', True))
        if not is_active:
            return jsonify({
                'reconhecido': False,
                'inactive': True,
                'error': 'Funcionário inativo. Contate o RH.'
            }), 403

        nome_funcionario = (
            funcionario.get('nome')
            or funcionario.get('name')
            or funcionario.get('full_name')
            or employee_id
        )
        cargo = funcionario.get('cargo') or funcionario.get('position') or ''
        # Foto CADASTRADA do funcionário (não a captura feita agora pro reconhecimento).
        # foto_s3_key é a fonte atual; foto_url/photo_url ficam como fallback legado.
        foto_s3_key = funcionario.get('foto_s3_key')
        if foto_s3_key:
            foto_url = generate_presigned_url(foto_s3_key, expiration_seconds=300) or ''
        else:
            foto_url = funcionario.get('foto_url') or funcionario.get('photo_url') or ''

        # 5) Determinar próximo tipo baseado no ÚLTIMO registro do dia.
        # Regra: alternar ENTRADA → SAÍDA → ENTRADA → SAÍDA indefinidamente.
        # Não há limite diário de registros — suporta almoço e múltiplos intervalos.
        hoje = datetime.now(TZ_SP).strftime('%Y-%m-%d')
        registros_hoje = _registros_do_dia(token_company_id, employee_id, hoje)

        if not registros_hoje:
            proximo_tipo = 'entrada'
            proximo_tipo_label = 'Entrada'
        else:
            ultimo = registros_hoje[-1]
            ultimo_tipo = (ultimo.get('type') or ultimo.get('tipo') or ultimo.get('tipo_registro', '')).lower()
            if ultimo_tipo in ('saida', 'saída', 'saida_almoco'):
                proximo_tipo = 'entrada'
                proximo_tipo_label = 'Entrada'
            else:
                proximo_tipo = 'saida'
                proximo_tipo_label = 'Saída'

        # ponto_completo sempre False — o fluxo é livre e sem cap diário.
        ponto_completo = False

        print(
            f"[FACIAL] OK company_id={token_company_id} employee_id={employee_id} "
            f"nome={nome_funcionario} similarity={similarity:.2f}% "
            f"proximo={proximo_tipo} registros_hoje={len(registros_hoje)}"
        )

        return jsonify({
            'reconhecido': True,
            'baixaConfianca': baixa_confianca,
            'ponto_completo': ponto_completo,
            'funcionario': {
                'funcionario_id': employee_id,
                'company_id': token_company_id,
                'nome': nome_funcionario,
                'cargo': cargo,
                'foto_url': foto_url,
            },
            'proximo_tipo': proximo_tipo,
            'proximo_tipo_label': proximo_tipo_label,
            'confianca': float(similarity) if similarity else 0.0,
        }), 200

    except Exception as e:
        import traceback
        print(f"[FACIAL] Erro inesperado em reconhecer_rosto: {e}")
        print(traceback.format_exc())
        return jsonify({
            'reconhecido': False,
            'error': 'Erro no reconhecimento facial',
            'error_type': type(e).__name__,
        }), 500
    finally:
        if temp_path:
            try:
                os.remove(temp_path)
            except Exception:
                pass


@routes_facial.route('/api/registrar_ponto_facial', methods=['POST', 'OPTIONS'])
@token_required
def registrar_ponto_facial(payload):
    """Grava o ponto após reconhecimento facial.

    Mesmas garantias de tenant: company_id vem SEMPRE do JWT, e o funcionário
    precisa existir em Employees(company_id=token_company_id, id=funcionario_id).
    Sem fallback cross-tenant.
    """
    try:
        token_company_id = payload.get('company_id')
        if not token_company_id:
            return jsonify({'error': 'Token sem company_id; faça login novamente.'}), 401

        data = request.get_json() or {}
        funcionario_id = data.get('funcionario_id')

        if not funcionario_id:
            return jsonify({'error': 'funcionario_id é obrigatório'}), 400

        # Defesa: se o cliente mandar company_id no body, ignorar/validar mas
        # JAMAIS usá-lo como fonte. A fonte é o JWT.
        body_company_id = data.get('company_id')
        if body_company_id and body_company_id != token_company_id:
            _log_tenant_mismatch(
                endpoint='registrar_ponto_facial',
                expected=token_company_id,
                matched=body_company_id,
                extra={'where': 'body-company-id-divergent'},
            )
            return jsonify({'error': 'Funcionário não pertence a esta empresa'}), 403

        # 1) Funcionário PRECISA existir nesta empresa (get_item estrito).
        funcionario = _buscar_funcionario_tenant_safe(token_company_id, funcionario_id)
        if not funcionario:
            print(
                f"[FACIAL] registrar_ponto_facial: funcionario_id={funcionario_id} "
                f"não existe em company_id={token_company_id}. Rejeitando."
            )
            return jsonify({'error': 'Funcionário não pertence a esta empresa'}), 403

        is_active = funcionario.get('is_active', funcionario.get('ativo', True))
        if not is_active:
            return jsonify({'error': 'Funcionário inativo. Contate o RH.', 'inactive': True}), 403

        nome_funcionario = (
            funcionario.get('nome')
            or funcionario.get('name')
            or funcionario.get('full_name')
            or funcionario_id
        )

        # 2) Configurações da empresa (sempre via PK).
        from decimal import Decimal

        location_lat = Decimal('0')
        location_lon = Decimal('0')
        config = {}
        try:
            cfg_resp = tabela_configuracoes.get_item(Key={'company_id': token_company_id})
            config = cfg_resp.get('Item', {}) or {}
            location_lat = Decimal(str(config.get('latitude', 0)))
            location_lon = Decimal(str(config.get('longitude', 0)))
        except Exception as e:
            print(f"[FACIAL] Aviso: configurações da empresa não obtidas: {e}")

        # 3) Determinar horário do registro.
        # Online:  usa horário do servidor (fonte autoritativa).
        # Offline: usa data_hora enviado pelo PWA (horário real da captura no tablet).
        #          O servidor NUNCA sobrescreve o horário de um registro offline.
        agora_servidor = datetime.now(TZ_SP)
        is_offline = bool(data.get('offline'))

        if is_offline:
            data_hora_body = (data.get('data_hora') or '').strip()
            if not data_hora_body:
                return jsonify({'error': 'data_hora é obrigatório para registros offline'}), 400
            try:
                agora_registro = TZ_SP.localize(
                    datetime.strptime(data_hora_body[:19], '%Y-%m-%d %H:%M:%S')
                )
            except ValueError:
                return jsonify({
                    'error': f'data_hora inválido: {data_hora_body!r}. Formato esperado: YYYY-MM-DD HH:MM:SS'
                }), 400
            # Rejeitar apenas se o relógio do tablet estiver mais de 5 min adiantado em relação ao servidor
            if (agora_registro - agora_servidor).total_seconds() > 300:
                return jsonify({
                    'error': 'Horário do registro está no futuro. Verifique o relógio do dispositivo.'
                }), 400
        else:
            agora_registro = agora_servidor

        # 4) Determinar entrada/saída via Query tenant-aware.
        # Para offline, usa a DATA DO REGISTRO ORIGINAL (não a data de hoje no servidor).
        # Regra: baseado no ÚLTIMO registro do dia — alterna ENTRADA → SAÍDA → ENTRADA → SAÍDA.
        hoje = agora_registro.strftime('%Y-%m-%d')
        registros_hoje = _registros_do_dia(token_company_id, funcionario_id, hoje)

        if not registros_hoje:
            tipo = 'entrada'
        else:
            ultimo = registros_hoje[-1]
            ultimo_tipo = (ultimo.get('type') or ultimo.get('tipo') or ultimo.get('tipo_registro', '')).lower()
            tipo = 'entrada' if ultimo_tipo in ('saida', 'saída', 'saida_almoco') else 'saida'

            # Bloquear registro duplicado só para online (evita duplo-clique por esquecimento).
            # Offline não aplica: o registro foi feito intencionalmente no momento da captura.
            if not is_offline:
                ultimo_ts_str = str(ultimo.get('timestamp') or ultimo.get('data_hora') or '')
                if ultimo_ts_str:
                    try:
                        if 'T' in ultimo_ts_str:
                            ultimo_dt = datetime.fromisoformat(ultimo_ts_str.replace('Z', '+00:00'))
                            if ultimo_dt.tzinfo is None:
                                ultimo_dt = TZ_SP.localize(ultimo_dt)
                        else:
                            ultimo_dt = datetime.strptime(ultimo_ts_str[:19], '%Y-%m-%d %H:%M:%S')
                            ultimo_dt = TZ_SP.localize(ultimo_dt)
                        diff_min = (agora_servidor - ultimo_dt).total_seconds() / 60
                        if diff_min < 5:
                            return jsonify({
                                'success': False,
                                'too_soon': True,
                                'error': 'Você já registrou em menos de 5 minutos',
                            }), 200
                    except Exception as e_ts:
                        print(f"[FACIAL] Aviso ao verificar intervalo mínimo: {e_ts}")

        tipo_label = {'entrada': 'Entrada', 'saida': 'Saída', 'saída': 'Saída'}.get(tipo, tipo)

        timestamp_iso = agora_registro.isoformat()
        date_time_str = agora_registro.strftime('%Y-%m-%d %H:%M:%S')
        composite_key = f"{funcionario_id}#{date_time_str}"

        # data_hora_calculo é sempre igual ao horário real da batida. O bônus de
        # tolerância para atrasos pequenos é aplicado apenas no cálculo de horas
        # trabalhadas (calculation_engine.calculate_tolerance_rounding_minutes),
        # nunca sobrescrevendo o horário exibido/gravado aqui.
        data_hora_calculo = date_time_str

        registro = {
            'company_id': token_company_id,
            'employee_id#date_time': composite_key,
            'employee_id': funcionario_id,
            'timestamp': timestamp_iso,
            'data_hora': date_time_str,
            'data_hora_calculo': data_hora_calculo,
            'date': agora_registro.strftime('%Y-%m-%d'),
            'time': agora_registro.strftime('%H:%M:%S'),
            'type': tipo,
            'method': 'CAMERA_OFFLINE' if is_offline else 'CAMERA',
            'funcionario_nome': nome_funcionario,
            'location': {
                'latitude': location_lat,
                'longitude': location_lon,
            },
            'distance_from_company': Decimal('0'),
            'source': 'OFFLINE_SYNC' if is_offline else 'ONLINE',
            'recorded_at': timestamp_iso,
        }

        if is_offline:
            registro['synced_at'] = agora_servidor.isoformat()

        tabela_registros.put_item(Item=registro)
        print(
            f"[FACIAL] Ponto gravado: company_id={token_company_id} key={composite_key} "
            f"tipo={tipo} source={'OFFLINE_SYNC' if is_offline else 'ONLINE'}"
        )

        return jsonify({
            'success': True,
            'tipo': tipo,
            'tipo_label': tipo_label,
            'timestamp': timestamp_iso,
            'mensagem': f'Ponto de {tipo_label} registrado com sucesso!',
            'registro': {
                'tipo': tipo,
                'tipo_label': tipo_label,
                'horario': agora_registro.strftime('%H:%M:%S'),
                'data': agora_registro.strftime('%d/%m/%Y'),
                'metodo': 'offline_sync' if is_offline else 'reconhecimento_facial',
            },
        }), 200

    except Exception as e:
        import traceback
        print(f"[FACIAL] Erro em registrar_ponto_facial: {e}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': 'Erro ao registrar ponto',
        }), 500


@routes_facial.route('/api/funcionario/cadastrar_foto', methods=['POST', 'OPTIONS'])
@token_required
def cadastrar_foto_funcionario(payload):
    """Auto-cadastro de foto/biometria no primeiro acesso do funcionário.

    Regras:
    - funcionario_id vem SEMPRE do JWT — nunca do body. Um funcionário não
      pode cadastrar/sobrescrever a foto de outro (mesma garantia de posse
      que faltava no endpoint administrativo de recadastro).
    - Só permite se o funcionário AINDA NÃO tem face_id cadastrado. Depois do
      primeiro cadastro, trocar a biometria é exclusivo do RH pelo painel
      (PUT /api/funcionarios/<id>/foto) — decisão de produto para impedir
      troca de identidade facial sem supervisão.
    """
    if request.method == 'OPTIONS':
        return '', 200

    if payload.get('tipo') != 'funcionario':
        return jsonify({'error': 'Endpoint exclusivo para login de funcionário'}), 403

    token_company_id = payload.get('company_id')
    funcionario_id = payload.get('funcionario_id')
    if not token_company_id or not funcionario_id:
        return jsonify({'error': 'Token sem company_id/funcionario_id; faça login novamente.'}), 401

    if 'foto' not in request.files:
        return jsonify({'error': 'Nenhuma foto enviada'}), 400

    funcionario = _buscar_funcionario_tenant_safe(token_company_id, funcionario_id)
    if not funcionario:
        return jsonify({'error': 'Funcionário não encontrado nesta empresa'}), 403

    if funcionario.get('face_id'):
        return jsonify({
            'error': 'Você já tem uma foto cadastrada. Para trocar, entre em contato com o RH.',
            'motivo': 'foto_ja_cadastrada',
        }), 409

    foto = request.files['foto']
    temp_path = os.path.join(tempfile.gettempdir(), f"temp_{uuid.uuid4().hex}.jpg")
    foto.save(temp_path)

    try:
        if not rekognition:
            return jsonify({'error': 'Serviço de reconhecimento facial indisponível no momento.'}), 503

        face_id = None
        index_error = None
        try:
            with open(temp_path, 'rb') as _f:
                _raw = _f.read()
            rekognition_response = rekognition.index_faces(
                CollectionId=COLLECTION,
                Image={'Bytes': _resize_for_rekognition(_raw)},
                ExternalImageId=f"{token_company_id}_{funcionario_id}",
                MaxFaces=1,
                QualityFilter="AUTO",
            )
            records = rekognition_response.get('FaceRecords', [])
            if records:
                face_id = records[0].get('Face', {}).get('FaceId')
            else:
                index_error = 'baixa_qualidade'
        except Exception as rek_e:
            print(f"[FACIAL] cadastrar_foto_funcionario: Rekognition falhou: {rek_e}")
            index_error = 'erro_rekognition'

        if index_error:
            return jsonify({
                'error': (
                    'Não foi possível cadastrar o rosto nesta foto. Verifique se o '
                    'rosto está bem iluminado, de frente para a câmera e sem '
                    'obstruções, e tente novamente.'
                ),
                'motivo': index_error,
            }), 400

        foto_nome = f"funcionarios/{funcionario_id}.jpg"
        foto_s3_key = enviar_s3(temp_path, foto_nome, token_company_id)
        foto_url = generate_presigned_url(foto_s3_key, expiration_seconds=300)

        tabela_funcionarios.update_item(
            Key={'company_id': token_company_id, 'id': funcionario_id},
            UpdateExpression='SET face_id = :fid, foto_s3_key = :fkey',
            ExpressionAttributeValues={':fid': face_id, ':fkey': foto_s3_key},
        )

        print(f"[FACIAL] Foto auto-cadastrada: company_id={token_company_id} funcionario_id={funcionario_id}")
        return jsonify({'success': True, 'foto_url': foto_url}), 200

    except Exception as e:
        import traceback
        print(f"[FACIAL] Erro em cadastrar_foto_funcionario: {e}")
        print(traceback.format_exc())
        return jsonify({'error': 'Erro ao cadastrar foto'}), 500
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


@routes_facial.route('/api/funcionario/registrar_ponto', methods=['POST', 'OPTIONS'])
@token_required
def registrar_ponto_funcionario(payload):
    """Registro de ponto self-service do funcionário: reconhecimento facial
    (obrigatório, trava de identidade contra o próprio JWT) + geolocalização
    (best-effort, NUNCA bloqueia — Portaria 671/2021 proíbe impedir o
    registro de ponto; o app do funcionário nunca exibe o status de raio,
    só o painel administrativo).
    """
    if request.method == 'OPTIONS':
        return '', 200

    temp_path = None
    try:
        if payload.get('tipo') != 'funcionario':
            return jsonify({'success': False, 'error': 'Endpoint exclusivo para login de funcionário'}), 403

        token_company_id = payload.get('company_id')
        funcionario_id = payload.get('funcionario_id')
        if not token_company_id or not funcionario_id:
            return jsonify({'success': False, 'error': 'Token sem company_id/funcionario_id; faça login novamente.'}), 401

        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'Nenhuma imagem enviada'}), 400

        file = request.files['image']
        if not file or file.filename == '':
            return jsonify({'success': False, 'error': 'Nome de arquivo vazio'}), 400

        filename = secure_filename(f"temp_{uuid.uuid4().hex}.jpg")
        temp_path = os.path.join(tempfile.gettempdir(), filename)
        file.save(temp_path)

        # 1) Match facial + validação de tenant (mesmo helper do reconhecer_rosto).
        match = reconhecer_funcionario(temp_path, expected_company_id=token_company_id)
        status = match.get('status') if isinstance(match, dict) else 'ERROR'

        if status == 'NO_FACE':
            return jsonify({
                'success': False,
                'error': 'Nenhum rosto detectado. Posicione seu rosto no centro e tente novamente.',
                'motivo': 'nenhum_rosto',
            }), 400

        if status == 'NO_MATCH':
            return jsonify({
                'success': False,
                'error': 'Rosto não reconhecido. Tente novamente ou procure o RH.',
                'motivo': 'rosto_nao_confere',
            }), 403

        if status in ('INVALID_EXTERNAL_ID', 'TENANT_MISMATCH'):
            _log_tenant_mismatch(
                endpoint='registrar_ponto_funcionario',
                expected=token_company_id,
                matched=match.get('matched_company_id'),
                extra={'external_image_id': match.get('external_image_id')},
            )
            return jsonify({'success': False, 'error': 'Rosto não reconhecido. Tente novamente ou procure o RH.', 'motivo': 'rosto_nao_confere'}), 403

        if status not in ('OK', 'LOW_CONFIDENCE'):
            return jsonify({'success': False, 'error': f"Erro no reconhecimento: {match.get('reason', status)}"}), 500

        matched_employee_id = match['employee_id']
        matched_company_id = match['company_id']

        # 2) Defesa #2: re-checar tenant.
        if matched_company_id != token_company_id:
            _log_tenant_mismatch(
                endpoint='registrar_ponto_funcionario',
                expected=token_company_id,
                matched=matched_company_id,
                extra={'where': 'post-helper-recheck'},
            )
            return jsonify({'success': False, 'error': 'Rosto não reconhecido. Tente novamente ou procure o RH.', 'motivo': 'rosto_nao_confere'}), 403

        # 3) Trava de identidade: o rosto reconhecido TEM que ser o do funcionário logado.
        #    Não é uma restrição de local — é prova de identidade, equivalente à senha.
        if matched_employee_id != funcionario_id:
            _log_tenant_mismatch(
                endpoint='registrar_ponto_funcionario',
                expected=funcionario_id,
                matched=matched_employee_id,
                extra={'where': 'identity-lock', 'company_id': token_company_id},
            )
            return jsonify({
                'success': False,
                'error': 'O rosto não confere com o seu cadastro.',
                'motivo': 'rosto_nao_confere',
            }), 403

        funcionario = _buscar_funcionario_tenant_safe(token_company_id, funcionario_id)
        if not funcionario:
            return jsonify({'success': False, 'error': 'Funcionário não pertence a esta empresa'}), 403

        is_active = funcionario.get('is_active', funcionario.get('ativo', True))
        if not is_active:
            return jsonify({'success': False, 'error': 'Funcionário inativo. Contate o RH.', 'inactive': True}), 403

        nome_funcionario = (
            funcionario.get('nome') or funcionario.get('name') or funcionario.get('full_name') or funcionario_id
        )

        # 4) Geofence NÃO-BLOQUEANTE. Fora do raio ou sem GPS nunca impede o registro —
        #    só marca o registro para o painel administrativo avaliar depois.
        user_lat_raw = request.form.get('latitude')
        user_lng_raw = request.form.get('longitude')
        gps_accuracy_raw = request.form.get('accuracy')

        fora_do_raio = None
        distance_from_company = None
        gps_status = 'indisponivel'
        location_payload = None

        if user_lat_raw and user_lng_raw:
            try:
                user_lat = float(user_lat_raw)
                user_lng = float(user_lng_raw)
                location_payload = {'latitude': Decimal(str(user_lat)), 'longitude': Decimal(str(user_lng))}
                if gps_accuracy_raw:
                    try:
                        location_payload['accuracy'] = Decimal(str(float(gps_accuracy_raw)))
                    except (TypeError, ValueError):
                        pass

                cfg_resp = tabela_configuracoes.get_item(Key={'company_id': token_company_id})
                config = cfg_resp.get('Item', {}) or {}
                company_lat = config.get('company_lat') or config.get('latitude')
                company_lng = config.get('company_lng') or config.get('longitude')
                raio_permitido = int(config.get('raio_permitido', 100))

                if company_lat and company_lng:
                    dentro, distancia = validar_localizacao(
                        user_lat, user_lng, float(company_lat), float(company_lng), raio_permitido,
                    )
                    fora_do_raio = not dentro
                    distance_from_company = Decimal(str(round(distancia, 1)))
                    gps_status = 'ok'
                else:
                    gps_status = 'empresa_sem_localizacao_configurada'
            except (TypeError, ValueError) as e:
                print(f"[FACIAL] Coordenadas inválidas em registrar_ponto_funcionario: {e}")
                gps_status = 'coordenadas_invalidas'

        # 5) Determinar próximo tipo (mesma alternação usada nos outros fluxos faciais).
        agora_registro = datetime.now(TZ_SP)
        hoje = agora_registro.strftime('%Y-%m-%d')
        registros_hoje = _registros_do_dia(token_company_id, funcionario_id, hoje)

        if not registros_hoje:
            tipo = 'entrada'
        else:
            ultimo = registros_hoje[-1]
            ultimo_tipo = (ultimo.get('type') or ultimo.get('tipo') or '').lower()
            tipo = 'entrada' if ultimo_tipo in ('saida', 'saída', 'saida_almoco') else 'saida'

            # Guarda de duplicata (evita duplo toque em poucos minutos).
            ultimo_ts_str = str(ultimo.get('timestamp') or ultimo.get('data_hora') or '')
            if ultimo_ts_str:
                try:
                    if 'T' in ultimo_ts_str:
                        ultimo_dt = datetime.fromisoformat(ultimo_ts_str.replace('Z', '+00:00'))
                        if ultimo_dt.tzinfo is None:
                            ultimo_dt = TZ_SP.localize(ultimo_dt)
                    else:
                        ultimo_dt = TZ_SP.localize(datetime.strptime(ultimo_ts_str[:19], '%Y-%m-%d %H:%M:%S'))
                    diff_min = (agora_registro - ultimo_dt).total_seconds() / 60
                    if diff_min < 5:
                        return jsonify({'success': False, 'too_soon': True, 'error': 'Você já registrou em menos de 5 minutos'}), 200
                except Exception as e_ts:
                    print(f"[FACIAL] Aviso ao verificar intervalo mínimo: {e_ts}")

        tipo_label = {'entrada': 'Entrada', 'saida': 'Saída'}.get(tipo, tipo)
        timestamp_iso = agora_registro.isoformat()
        date_time_str = agora_registro.strftime('%Y-%m-%d %H:%M:%S')
        composite_key = f"{funcionario_id}#{date_time_str}"

        registro = {
            'company_id': token_company_id,
            'employee_id#date_time': composite_key,
            'employee_id': funcionario_id,
            'timestamp': timestamp_iso,
            'data_hora': date_time_str,
            'data_hora_calculo': date_time_str,
            'date': agora_registro.strftime('%Y-%m-%d'),
            'time': agora_registro.strftime('%H:%M:%S'),
            'type': tipo,
            'method': 'FACIAL_GPS',
            'funcionario_nome': nome_funcionario,
            'source': 'ONLINE',
            'recorded_at': timestamp_iso,
            'gps_status': gps_status,
        }
        if location_payload:
            registro['location'] = location_payload
        if fora_do_raio is not None:
            registro['fora_do_raio'] = fora_do_raio
        if distance_from_company is not None:
            registro['distance_from_company'] = distance_from_company

        tabela_registros.put_item(Item=registro)
        print(
            f"[FACIAL] Ponto (facial+gps) gravado: company_id={token_company_id} key={composite_key} "
            f"tipo={tipo} fora_do_raio={fora_do_raio} gps_status={gps_status}"
        )

        # Resposta ao funcionário: NUNCA inclui status de raio (definição de produto —
        # ver painel administrativo para isso).
        return jsonify({
            'success': True,
            'tipo': tipo,
            'tipo_label': tipo_label,
            'timestamp': timestamp_iso,
            'mensagem': f'Ponto de {tipo_label} registrado com sucesso!',
        }), 200

    except Exception as e:
        import traceback
        print(f"[FACIAL] Erro em registrar_ponto_funcionario: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': 'Erro ao registrar ponto'}), 500
    finally:
        if temp_path:
            try:
                os.remove(temp_path)
            except Exception:
                pass


@routes_facial.route('/api/facial/health', methods=['GET'])
def health_check():
    """Verifica se o serviço de reconhecimento facial está ativo."""
    from utils.aws import rekognition, COLLECTION
    return jsonify({
        'status': 'ok',
        'rekognition_enabled': rekognition is not None,
        'collection': COLLECTION if rekognition else None,
    }), 200
