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
)

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

        if status != 'OK':
            return jsonify({
                'reconhecido': False,
                'error': f"Erro no reconhecimento: {match.get('reason', status)}"
            }), 500

        company_id = match['company_id']
        employee_id = match['employee_id']
        similarity = match.get('similarity', 0)

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
            if ultimo_tipo in ('saida', 'saída'):
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

        # 3) Determinar entrada/saída via Query tenant-aware.
        # Regra: baseado no ÚLTIMO registro do dia — alterna ENTRADA → SAÍDA → ENTRADA → SAÍDA.
        agora = datetime.now(TZ_SP)
        hoje = agora.strftime('%Y-%m-%d')
        registros_hoje = _registros_do_dia(token_company_id, funcionario_id, hoje)

        if not registros_hoje:
            tipo = 'entrada'
        else:
            ultimo = registros_hoje[-1]
            ultimo_tipo = (ultimo.get('type') or ultimo.get('tipo') or ultimo.get('tipo_registro', '')).lower()
            tipo = 'entrada' if ultimo_tipo in ('saida', 'saída') else 'saida'

        tipo_label = {'entrada': 'Entrada', 'saida': 'Saída', 'saída': 'Saída'}.get(tipo, tipo)

        timestamp_iso = agora.isoformat()
        date_time_str = agora.strftime('%Y-%m-%d %H:%M:%S')
        composite_key = f"{funcionario_id}#{date_time_str}"

        # 4) Arredondamento para cálculo (entrada dentro da tolerância).
        data_hora_calculo = date_time_str
        if tipo == 'entrada':
            try:
                tolerancia_atraso = int(config.get('tolerancia_atraso', 5))
                horario_entrada_esperado = funcionario.get('horario_entrada')
                if horario_entrada_esperado:
                    data_str = agora.strftime('%Y-%m-%d')
                    try:
                        entrada_esperada = datetime.strptime(
                            f"{data_str} {horario_entrada_esperado}", '%Y-%m-%d %H:%M'
                        )
                    except Exception:
                        entrada_esperada = datetime.strptime(
                            f"{data_str} {horario_entrada_esperado}", '%Y-%m-%d %H:%M:%S'
                        )
                    entrada_esperada = TZ_SP.localize(entrada_esperada)
                    diff_min = int((agora - entrada_esperada).total_seconds() // 60)
                    if diff_min <= tolerancia_atraso:
                        data_hora_calculo = f"{data_str} {horario_entrada_esperado}"
                        print(
                            f"[FACIAL] Entrada dentro da tolerância ({diff_min}min). "
                            f"Cálculo arredondado para {horario_entrada_esperado}"
                        )
            except Exception as e:
                print(f"[FACIAL] Aviso ao calcular arredondamento: {e}")

        registro = {
            'company_id': token_company_id,
            'employee_id#date_time': composite_key,
            'employee_id': funcionario_id,
            'timestamp': timestamp_iso,
            'data_hora': date_time_str,
            'data_hora_calculo': data_hora_calculo,
            'date': agora.strftime('%Y-%m-%d'),
            'time': agora.strftime('%H:%M:%S'),
            'type': tipo,
            'method': 'CAMERA',
            'funcionario_nome': nome_funcionario,
            'location': {
                'latitude': location_lat,
                'longitude': location_lon,
            },
            'distance_from_company': Decimal('0'),
        }

        tabela_registros.put_item(Item=registro)
        print(
            f"[FACIAL] Ponto gravado: company_id={token_company_id} key={composite_key} tipo={tipo}"
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
                'horario': agora.strftime('%H:%M:%S'),
                'data': agora.strftime('%d/%m/%Y'),
                'metodo': 'reconhecimento_facial',
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


@routes_facial.route('/api/facial/health', methods=['GET'])
def health_check():
    """Verifica se o serviço de reconhecimento facial está ativo."""
    from utils.aws import rekognition, COLLECTION
    return jsonify({
        'status': 'ok',
        'rekognition_enabled': rekognition is not None,
        'collection': COLLECTION if rekognition else None,
    }), 200
