from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
import uuid
import tempfile
import os
import boto3
from utils.aws import (
    tabela_funcionarios, tabela_registros, enviar_s3, reconhecer_funcionario, rekognition, BUCKET, COLLECTION, REGIAO, tabela_usuarioempresa, tabela_configuracoes
)
from functools import wraps
from utils.auth import verify_token
from werkzeug.security import check_password_hash
import jwt
from flask import current_app
from boto3.dynamodb.conditions import Attr, Key
from services.overtime import calculate_overtime, format_minutes_to_time
from utils.geolocation import validar_localizacao, formatar_distancia
import unicodedata
import re
from utils.logger import setup_logger
from utils.schedule import (
    build_pt_schedule_from_legacy,
    build_weekly_from_legacy,
    get_first_active_times,
    get_schedule_for_date,
    normalize_preset_schedule,
    pt_schedule_to_weekly,
)

s3 = boto3.client('s3', region_name=REGIAO)

routes = Blueprint('routes', __name__)

logger = setup_logger()

# Função para normalizar string removendo acentos e caracteres especiais
def normalizar_string(texto):
    """
    Remove acentos e caracteres especiais, mantendo apenas letras, números, underscore e hífen.
    Usado para criar IDs compatíveis com AWS Rekognition.
    """
    if not texto:
        return texto
    # Normalizar unicode (decompor caracteres acentuados)
    nfkd = unicodedata.normalize('NFKD', texto)
    # Remover acentos
    sem_acento = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    # Manter apenas caracteres permitidos: a-zA-Z0-9_.-
    limpo = re.sub(r'[^a-zA-Z0-9_.\-]', '_', sem_acento)
    return limpo

def _emp_tem_intervalo(funcionario):
    """Verifica de forma robusta se o funcionário tem intervalo_emp definido (> 0).
    Cobre edge cases: None, '', '0', 'None', 'null', False, Decimal(0), 0.
    Retorna (bool, int) - se tem intervalo e o valor numérico.
    """
    val = funcionario.get('intervalo_emp') if isinstance(funcionario, dict) else None
    try:
        num = int(val) if val is not None and str(val).strip() not in ('', 'None', 'null', 'false', 'False') else 0
    except (ValueError, TypeError):
        num = 0
    return num > 0, num


def _get_company_presets(company_id: str):
    try:
        response = tabela_configuracoes.get_item(Key={'company_id': company_id})
        config_item = response.get('Item', {})
        presets = config_item.get('horarios_preset', [])
        if not isinstance(presets, list):
            return []
        return [normalize_preset_schedule(p) for p in presets]
    except Exception as e:
        print(f"[PRESET] Erro ao buscar presets: {e}")
        return []


def _find_preset_by_name(presets, name: str):
    return next((p for p in presets if p.get('nome') == name), None)


def _apply_preset_to_employee(employee_item: dict, preset: dict):
    if not preset:
        return
    preset = normalize_preset_schedule(preset)
    horarios = preset.get('horarios') or {}
    weekly = pt_schedule_to_weekly(horarios)
    if weekly:
        employee_item['custom_schedule'] = weekly
    entrada, saida = get_first_active_times(horarios)
    if entrada and saida:
        employee_item['horario_entrada'] = entrada
        employee_item['horario_saida'] = saida
    employee_item['pred_hora'] = preset.get('nome')

# CORS configurado globalmente no app.py

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # OPTIONS requests pass through without token validation (CORS preflight)
        if request.method == 'OPTIONS':
            # Call function with None payload for OPTIONS
            return ('', 200)
        
        token = None
        # O token pode vir no header Authorization: Bearer <token>
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        if not token:
            return jsonify({'error': 'Token ausente'}), 401
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        return f(payload, *args, **kwargs)
    return decorated

@routes.route('/', methods=['GET', 'OPTIONS'])
def health():
    logger.info(f"Request received: {request.method} {request.path}")
    return 'OK', 200

@routes.route('/registros/<registro_id>/invalidar', methods=['PUT', 'OPTIONS'])
def invalidar_registro(registro_id):
    """Invalida um registro de ponto (soft delete). Requer justificativa."""
    # Tratar OPTIONS primeiro (CORS preflight)
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # O registro_id vem do frontend, mas agora precisamos do company_id também
        # Tentar extrair do token
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token ausente'}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401
        
        company_id = payload.get('company_id')
        
        if not company_id:
            return jsonify({'error': 'Company ID não encontrado no token'}), 400
        
        # Justificativa obrigatória
        data = request.get_json() or {}
        justificativa = (data.get('justificativa') or '').strip()
        if not justificativa:
            return jsonify({'error': 'Justificativa é obrigatória para invalidar um registro'}), 400
        
        try:
            # Extrair composite_key do registro_id
            # Formatos possíveis:
            # 1. company_id_employee_id#date_time
            # 2. company_id_employee_id_timestamp
            composite_key = None
            if '_' not in registro_id:
                print(f"[DELETE REGISTRO] Formato de registro_id inválido: {registro_id}")
                return jsonify({'error': 'Formato de registro_id inválido'}), 400
            parts = registro_id.split('_')
            if len(parts) < 2:
                print(f"[DELETE REGISTRO] Não foi possível extrair company_id de: {registro_id}")
                return jsonify({'error': 'Formato de registro_id inválido'}), 400
            extracted_company_id = parts[0]
            remaining = '_'.join(parts[1:])
            # Se tem #, já é o formato novo
            if '#' in remaining:
                composite_key = remaining
            else:
                # Buscar registro que começa com remaining#
                response = tabela_registros.query(
                    KeyConditionExpression=Key('company_id').eq(company_id) & Key('employee_id#date_time').begins_with(f"{remaining}#")
                )
                items = response.get('Items', [])
                if not items:
                    print(f"[DELETE REGISTRO] Nenhum registro encontrado começando com {remaining}#")
                    return jsonify({'error': 'Registro não encontrado'}), 404
                composite_key = items[0].get('employee_id#date_time', None)
            if not composite_key:
                return jsonify({'error': 'Chave do registro não encontrada'}), 400
            # Validar se o company_id extraído corresponde ao do token
            if extracted_company_id != company_id:
                print(f"[DELETE REGISTRO] Company ID não corresponde: {extracted_company_id} != {company_id}")
                return jsonify({'error': 'Acesso negado'}), 403
            # Verificar se o registro existe antes de invalidar
            verify_response = tabela_registros.get_item(Key={
                'company_id': company_id,
                'employee_id#date_time': composite_key
            })
            if 'Item' not in verify_response:
                print(f"[INVALIDAR REGISTRO] ❌ Registro não encontrado no DynamoDB")
                return jsonify({'error': 'Registro não encontrado'}), 404
            
            registro_atual = verify_response['Item']
            status_atual = registro_atual.get('status', 'ATIVO')
            if status_atual == 'INVALIDADO':
                return jsonify({'error': 'Registro já está invalidado'}), 400
            
            # Atualizar status para INVALIDADO (soft delete)
            tabela_registros.update_item(
                Key={
                    'company_id': company_id,
                    'employee_id#date_time': composite_key
                },
                UpdateExpression='SET #status = :status, justificativa = :justificativa, invalidado_em = :now, invalidado_por = :user',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'INVALIDADO',
                    ':justificativa': justificativa,
                    ':now': datetime.now().isoformat(),
                    ':user': payload.get('usuario_id', payload.get('email', 'admin'))
                }
            )
            print(f"[INVALIDAR REGISTRO] ✅ Registro invalidado com sucesso! Justificativa: {justificativa}")
            return jsonify({'success': True, 'message': 'Registro invalidado com sucesso'}), 200
        except Exception:
            import traceback
            traceback.print_exc()
            return jsonify({'error': 'Erro ao invalidar registro'}), 500

    except Exception as e:
        print(f"Erro ao invalidar registro: {str(e)}")
        return jsonify({'error': 'Erro ao invalidar registro'}), 500


# Removido em 2026-05: bloco de ~310 linhas de código morto (unreachable após
# o return acima) que replicava um antigo registrar_ponto_facial com
# tabela_funcionarios.scan(Attr('id').eq(funcionario_id)) sem filtro de
# company_id (cross-tenant). Era um trap em refactors futuros. Fluxo facial
# canônico vive em routes/facial.py — tenant-aware.


def obter_funcionario(payload, funcionario_id):
    try:
        empresa_id = payload.get('company_id')
        
        if not empresa_id:
            return jsonify({'error': 'Company ID não encontrado no token'}), 400
        
        # Query usando composite key (company_id + id)
        try:
            response = tabela_funcionarios.get_item(Key={
                'company_id': empresa_id,
                'id': funcionario_id
            })
            funcionario = response.get('Item')
        except Exception as e:
            print(f"[GET] Erro ao buscar funcionário: {str(e)}")
            # Fallback: scan
            response = tabela_funcionarios.scan(
                FilterExpression=Attr('id').eq(funcionario_id) & Attr('company_id').eq(empresa_id)
            )
            items = response.get('Items', [])
            funcionario = items[0] if items else None
        
        if not funcionario:
            return jsonify({'error': 'Funcionário não encontrado'}), 404
        
        # Verificar se funcionário está ativo
        is_active = funcionario.get('is_active', funcionario.get('ativo', True))
        if not is_active:
            return jsonify({
                'error': 'Funcionário inativo',
                'deleted_at': funcionario.get('deleted_at')
            }), 404
        
        return jsonify(funcionario)
    except Exception as e:
        print(f"[GET] Erro geral: {str(e)}")
        return jsonify({'error': str(e)}), 500

@routes.route('/funcionarios/<funcionario_id>', methods=['GET'])
@token_required
def buscar_funcionario(payload, funcionario_id):
    empresa_id = payload.get('company_id')
    if not empresa_id:
        return jsonify({'error': 'Company ID não encontrado no token'}), 400
    try:
        resp = tabela_funcionarios.get_item(Key={'company_id': empresa_id, 'id': funcionario_id})
        item = resp.get('Item')
        if not item:
            return jsonify({'error': 'Funcionário não encontrado'}), 404
        return jsonify(item)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@routes.route('/funcionarios/<funcionario_id>', methods=['PUT'])
@token_required
def atualizar_funcionario(payload, funcionario_id):
    try:
        empresa_id = payload.get('company_id')
        
        if not empresa_id:
            return jsonify({'error': 'Company ID não encontrado no token'}), 400
        

        # Buscar funcionário usando composite key
        try:
            response = tabela_funcionarios.get_item(Key={
                'company_id': empresa_id,
                'id': funcionario_id
            })
            funcionario = response.get('Item')
        except Exception as e:
            print(f"[PUT] Erro ao buscar funcionário: {str(e)}")
            # Fallback: scan
            response = tabela_funcionarios.scan(
                FilterExpression=Attr('id').eq(funcionario_id) & Attr('company_id').eq(empresa_id)
            )
            items = response.get('Items', [])
            funcionario = items[0] if items else None
        
        if not funcionario:
            return jsonify({'error': 'Funcionário não encontrado'}), 404
        
        # Corrigir: ler nome/cargo de request.form (FormData)
        nome = request.form.get('nome')
        cargo = request.form.get('cargo')
        login = request.form.get('login')
        senha = request.form.get('senha')
        horario_entrada = request.form.get('horario_entrada')  # Novo: horário de entrada
        horario_saida = request.form.get('horario_saida')  # Novo: horário de saída
        nome_horario = request.form.get('nome_horario')  # Nome do horário pré-definido
        tipo_horario = request.form.get('tipo_horario')
        home_office = request.form.get('home_office', 'false').lower() == 'true'
        
        if not nome or not cargo:
            return jsonify({'error': 'Nome e cargo são obrigatórios'}), 400

        # Login de funcionário
        
        # Hash da senha se fornecida
        if senha and senha.strip():
            from utils.auth import hash_password
            senha_hash = hash_password(senha)
            funcionario['senha_hash'] = senha_hash
            # Armazenar senha original para exibição (AVISO: não é seguro, apenas para conveniência)
            funcionario['senha_original'] = senha
            print(f"[PUT] Nova senha definida para funcionário {funcionario_id}")
            
        # Atualizar foto se fornecida
        if 'foto' in request.files:
            foto = request.files['foto']
            temp_path = os.path.join(tempfile.gettempdir(), f"temp_{uuid.uuid4().hex}.jpg")
            foto.save(temp_path)
            # Upload into company folder
            foto_url = enviar_s3(temp_path, f"funcionarios/{funcionario_id}.jpg", empresa_id)
            if 'face_id' in funcionario and rekognition:
                try:
                    rekognition.delete_faces(
                        CollectionId=COLLECTION,
                        FaceIds=[funcionario['face_id']]
                    )
                except Exception as e:
                    print(f"Aviso: falha ao deletar face anterior: {e}")
            with open(temp_path, 'rb') as image:
                if rekognition:
                    rekognition_response = rekognition.index_faces(
                        CollectionId=COLLECTION,
                        Image={'Bytes': image.read()},
                        ExternalImageId=f"{empresa_id}_{funcionario_id}",
                        MaxFaces=1,
                        QualityFilter="AUTO",
                        DetectionAttributes=["ALL"]
                    )
                else:
                    rekognition_response = {'FaceRecords': []}
            face_id = rekognition_response.get('FaceRecords', [{}])[0].get('Face', {}).get('FaceId')
            os.remove(temp_path)
            funcionario['foto_url'] = foto_url
            funcionario['face_id'] = face_id
            
        funcionario['nome'] = nome
        funcionario['cargo'] = cargo
        
        # Atualizar login se fornecido
        if login and login.strip():
            funcionario['login'] = login.strip()
        elif login == '':  # Se enviou string vazia, remover login
            funcionario.pop('login', None)
            funcionario.pop('senha_hash', None)  # Remover senha também
        
        # Atualizar horários se fornecidos
        if horario_entrada:
            funcionario['horario_entrada'] = horario_entrada
        if horario_saida:
            funcionario['horario_saida'] = horario_saida
        
        # Atualizar home_office
        funcionario['home_office'] = home_office

        # Atualizar intervalo personalizado se fornecido
        ip_val = request.form.get('intervalo_personalizado')
        if ip_val is not None:
            intervalo_personalizado = ip_val.lower() == 'true'
            funcionario['intervalo_personalizado'] = intervalo_personalizado
            if intervalo_personalizado:
                emp_val = request.form.get('intervalo_emp')
                try:
                    funcionario['intervalo_emp'] = int(emp_val) if emp_val else None
                except Exception:
                    funcionario['intervalo_emp'] = None

        # Aplicar regras de horário por dia
        if tipo_horario == 'variavel':
            funcionario.pop('horario_entrada', None)
            funcionario.pop('horario_saida', None)
            funcionario.pop('pred_hora', None)
            funcionario.pop('custom_schedule', None)
        else:
            presets = _get_company_presets(empresa_id)
            preset_name = nome_horario or cargo
            preset = _find_preset_by_name(presets, preset_name) if preset_name else None
            if preset:
                _apply_preset_to_employee(funcionario, preset)
            elif horario_entrada and horario_saida:
                funcionario['custom_schedule'] = build_weekly_from_legacy(horario_entrada, horario_saida)
            else:
                # definir para o padrão da empresa (apenas se intervalo automático estiver ativo)
                try:
                    cfg_resp = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
                    cfg = cfg_resp.get('Item', {})
                    if cfg.get('intervalo_automatico', False):
                        funcionario['intervalo_emp'] = int(cfg.get('duracao_intervalo', 60))
                    else:
                        funcionario['intervalo_emp'] = None
                except Exception:
                    funcionario['intervalo_emp'] = None
        
        tabela_funcionarios.put_item(Item=funcionario)
        return jsonify({'message': 'Funcionário atualizado com sucesso!'}), 200
    except Exception as e:
        print(f"Erro ao atualizar funcionário: {str(e)}")
        return jsonify({'error': 'Erro ao atualizar funcionário'}), 500

@routes.route('/funcionarios/<funcionario_id>/foto', methods=['PUT'])
@token_required
def atualizar_foto_funcionario(payload, funcionario_id):
    if 'foto' not in request.files:
        return jsonify({"error": "Nenhuma foto enviada"}), 400
    foto = request.files['foto']
    temp_path = os.path.join(tempfile.gettempdir(), f"temp_{uuid.uuid4().hex}.jpg")
    foto.save(temp_path)
    try:
        empresa_id = payload.get('company_id')
        
        if not empresa_id:
            return jsonify({'error': 'Company ID não encontrado no token'}), 400
        
        # Buscar funcionário usando composite key
        try:
            response = tabela_funcionarios.get_item(Key={
                'company_id': empresa_id,
                'id': funcionario_id
            })
            funcionario = response.get('Item')
        except Exception as e:
            print(f"[PUT FOTO] Erro ao buscar funcionário: {str(e)}")
            # Fallback: scan
            response = tabela_funcionarios.scan(
                FilterExpression=Attr('id').eq(funcionario_id) & Attr('company_id').eq(empresa_id)
            )
            items = response.get('Items', [])
            funcionario = items[0] if items else None
        
        if not funcionario:
            return jsonify({'error': 'Funcionário não encontrado'}), 404

        if rekognition:
            response_faces = rekognition.list_faces(CollectionId=COLLECTION)
            for face in response_faces.get('Faces', []):
                external = face.get('ExternalImageId', '')
                # Match either raw id or prefixed company_id#id
                if external == funcionario_id or external.endswith(f"#{funcionario_id}"):
                    try:
                        rekognition.delete_faces(
                            CollectionId=COLLECTION,
                            FaceIds=[face['FaceId']]
                        )
                    except Exception as e:
                        print(f"Aviso: falha ao deletar face: {e}")
                    break

        foto_nome = f"funcionarios/{funcionario_id}.jpg"
        # Upload under company prefix and index the S3 object
        foto_url = enviar_s3(temp_path, foto_nome, empresa_id)
        if rekognition:
            rekognition.index_faces(
                CollectionId=COLLECTION,
                Image={'S3Object': {'Bucket': BUCKET, 'Name': f"{empresa_id}/{foto_nome}"}},
                ExternalImageId=f"{empresa_id}_{funcionario_id}"
            )

        tabela_funcionarios.update_item(
            Key={'id': funcionario_id},
            UpdateExpression='SET foto_url = :url',
            ExpressionAttributeValues={':url': foto_url}
        )
        return jsonify({"success": True, "foto_url": foto_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.remove(temp_path)

@routes.route('/funcionarios/<funcionario_id>', methods=['DELETE'])
def excluir_funcionario(funcionario_id):
    try:
        # Recuperar token do header
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Token ausente'}), 401

        # Validar token
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido'}), 401

        empresa_id = payload.get('company_id')

        if not empresa_id:
            return jsonify({'error': 'Company ID não encontrado no token'}), 400

        # Buscar funcionário usando composite key (company_id + id)
        try:
            response = tabela_funcionarios.get_item(Key={
                'company_id': empresa_id,
                'id': funcionario_id
            })
            funcionario = response.get('Item')
        except Exception as e:
            print(f"[DELETE] Erro ao buscar funcionário: {str(e)}")
            # Fallback: tentar scan se get_item falhar
            response = tabela_funcionarios.scan(
                FilterExpression=Attr('id').eq(funcionario_id) & Attr('company_id').eq(empresa_id)
            )
            items = response.get('Items', [])
            funcionario = items[0] if items else None

        if not funcionario:
            return jsonify({'error': 'Funcionário não encontrado'}), 404

        # EXCLUSÃO LÓGICA: marcar como inativo ao invés de deletar
        from datetime import datetime
        
        # Remover face do Rekognition (segurança e LGPD)
        try:
            external_image_id = f"{empresa_id}_{funcionario_id}"
            print(f"[DELETE] Tentando remover face do Rekognition: {external_image_id}")
            rekognition_response = rekognition.list_faces(CollectionId=COLLECTION)
            for face in rekognition_response['Faces']:
                if face['ExternalImageId'] == external_image_id:
                    rekognition.delete_faces(
                        CollectionId=COLLECTION,
                        FaceIds=[face['FaceId']]
                    )
                    print(f"[DELETE] Face removida do Rekognition: {face['FaceId']}")
                    break
        except Exception as e:
            print(f"[DELETE] Erro ao excluir face no Rekognition: {str(e)}")
            # Não falhar se não conseguir remover do Rekognition

        # Atualizar funcionário com exclusão lógica
        try:
            # Timestamp atual
            deleted_timestamp = datetime.now(ZoneInfo('America/Sao_Paulo')).isoformat()
            
            # Campos para remover (LGPD)
            updates = {
                'is_active': False,
                'ativo': False,
                'deleted_at': deleted_timestamp,
                'senha_hash': None,  # Remover senha
                'login': None,  # Remover login
                'foto_url': None,  # Remover URL da foto
                'foto_s3_key': None  # Remover chave S3
            }
            
            # Construir UpdateExpression
            update_expr = "SET "
            expr_attr_values = {}
            expr_attr_names = {}
            
            for i, (key, value) in enumerate(updates.items()):
                attr_name = f"#{key}"
                attr_value = f":val{i}"
                
                if i > 0:
                    update_expr += ", "
                
                update_expr += f"{attr_name} = {attr_value}"
                expr_attr_names[attr_name] = key
                expr_attr_values[attr_value] = value if value is not None else ""
            
            # Atualizar registro
            tabela_funcionarios.update_item(
                Key={
                    'company_id': empresa_id,
                    'id': funcionario_id
                },
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values
            )
            
            print(f"[DELETE] Funcionário marcado como inativo (exclusão lógica): {funcionario_id}")
            print(f"[DELETE] Data da exclusão: {deleted_timestamp}")
            print(f"[INFO] Registros históricos (TimeRecords, DailySummary, MonthlySummary) foram mantidos")
            
        except Exception as e:
            print(f"[DELETE] Erro ao fazer exclusão lógica: {str(e)}")
            raise

        return jsonify({
            'message': 'Funcionário excluído com sucesso',
            'info': 'Exclusão lógica realizada. Registros históricos foram mantidos.'
        }), 200

    except Exception as e:
        print(f"Erro ao excluir funcionário: {str(e)}")
        return jsonify({'error': 'Erro ao excluir funcionário'}), 500

@routes.route('/cadastrar_funcionario', methods=['POST'])
@token_required
def cadastrar_funcionario(payload):
    try:
        # Suportar tanto FormData (com foto) quanto JSON (sem foto para testes)
        if request.content_type and 'application/json' in request.content_type:
            # Modo JSON (sem foto - para testes)
            data = request.get_json()
            nome = data.get('nome')
            cargo = data.get('cargo')
            cpf = data.get('cpf')
            horario_entrada = data.get('horario_entrada')
            horario_saida = data.get('horario_saida')
            nome_horario = data.get('nome_horario')  # Nome do horário pré-definido
            tipo_horario = data.get('tipo_horario')
            login = data.get('login')
            senha = data.get('senha')
            home_office = data.get('home_office', False)
            foto = None
            # Intervalo personalizado (JSON mode)
            intervalo_personalizado = bool(data.get('intervalo_personalizado', False))
            intervalo_emp = data.get('intervalo_emp')
            
            if not all([nome, cargo]):
                return jsonify({"error": "Nome e cargo são obrigatórios"}), 400
                
        else:
            # Modo FormData (com foto)
            nome = request.form.get('nome')
            cargo = request.form.get('cargo')
            foto = request.files.get('foto')
            cpf = request.form.get('cpf')
            horario_entrada = request.form.get('horario_entrada')
            horario_saida = request.form.get('horario_saida')
            nome_horario = request.form.get('nome_horario')  # Nome do horário pré-definido
            tipo_horario = request.form.get('tipo_horario')
            login = request.form.get('login')
            senha = request.form.get('senha')
            home_office = request.form.get('home_office', 'false').lower() == 'true'
            
            # Intervalo personalizado (opcional)
            intervalo_personalizado = request.form.get('intervalo_personalizado', 'false').lower() == 'true'
            intervalo_emp = None
            intervalo_emp_val = request.form.get('intervalo_emp')
            if intervalo_emp_val:
                try:
                    intervalo_emp = int(intervalo_emp_val)
                except Exception:
                    intervalo_emp = None

            if not all([nome, cargo, foto]):
                return jsonify({"error": "Nome, cargo e foto são obrigatórios"}), 400

        # Hash da senha se fornecida
        senha_hash = None
        if senha:
            from utils.auth import hash_password
            senha_hash = hash_password(senha)
        
        # Criar ID único para o funcionário: primeiro nome (sem acentos, minúsculo) + número aleatório
        primeiro_nome = nome.strip().split(' ')[0]
        primeiro_nome_normalizado = normalizar_string(primeiro_nome.lower())
        funcionario_id = f"{primeiro_nome_normalizado}_{uuid.uuid4().hex[:4]}"
        print(f"[CADASTRO] Nome original: {nome}, Primeiro nome normalizado: {primeiro_nome_normalizado}, ID: {funcionario_id}")
        
        # Dados da empresa a partir do token
        empresa_nome = payload.get('empresa_nome')
        empresa_id = payload.get('company_id')
        
        foto_url = None
        face_id = None
        temp_path = None
        
        # Processar foto se fornecida
        if foto:
            foto_nome = f"funcionarios/{funcionario_id}.jpg"
            temp_path = os.path.join(tempfile.gettempdir(), foto_nome.split('/')[-1])
            foto.save(temp_path)
            foto_url = enviar_s3(temp_path, foto_nome, empresa_id)

            # Indexar no Rekognition
            with open(temp_path, 'rb') as image:
                if rekognition:
                    rekognition_response = rekognition.index_faces(
                        CollectionId=COLLECTION,
                        Image={'Bytes': image.read()},
                        ExternalImageId=f"{empresa_id}_{funcionario_id}",
                        MaxFaces=1,
                        QualityFilter="AUTO",
                        DetectionAttributes=["DEFAULT"]
                    )
                else:
                    rekognition_response = {'FaceRecords': []}

            if not rekognition_response['FaceRecords']:
                if temp_path:
                    os.remove(temp_path)
                return jsonify({"error": "Nenhum rosto detectado na imagem."}), 400

            face_id = rekognition_response['FaceRecords'][0]['Face']['FaceId']

        # Preparar item do funcionário
        # Usar timezone do Brasil (UTC-3)
        try:
            br_tz = ZoneInfo('America/Sao_Paulo')
            data_hoje = datetime.now(br_tz).strftime('%Y-%m-%d')
        except:
            # Fallback se zoneinfo não estiver disponível
            data_hoje = datetime.now().strftime('%Y-%m-%d')
        
        print(f'[CADASTRO] Data de cadastro sendo salva: {data_hoje}')
        
        funcionario_item = {
            'company_id': empresa_id,  # Partition key
            'id': funcionario_id,      # Sort key
            'nome': nome,
            'cargo': cargo,
            'empresa_nome': empresa_nome,
            'data_cadastro': data_hoje
        }
        
        # Adicionar campos opcionais
        if foto_url:
            funcionario_item['foto_url'] = foto_url
            print(f'[CADASTRO] foto_url salva no DynamoDB: {foto_url}')
        if face_id:
            funcionario_item['face_id'] = face_id
        if cpf:
            funcionario_item['cpf'] = cpf
        if horario_entrada:
            funcionario_item['horario_entrada'] = horario_entrada
        if horario_saida:
            funcionario_item['horario_saida'] = horario_saida
        if nome_horario:
            funcionario_item['pred_hora'] = nome_horario
            print(f'[CADASTRO] pred_hora salva: {nome_horario}')
        if login:
            funcionario_item['login'] = login
        if senha_hash:
            funcionario_item['senha_hash'] = senha_hash
            # Armazenar senha original para exibição (AVISO: não é seguro, apenas para conveniência)
            funcionario_item['senha_original'] = senha
        
        # Campo home_office (para não exigir geolocalização)
        funcionario_item['home_office'] = home_office
        
        # Campos de exclusão lógica (iniciar como ativo)
        funcionario_item['is_active'] = True
        funcionario_item['ativo'] = True
        funcionario_item['deleted_at'] = None
        # Definir intervalo efetivo do funcionário
        if request.content_type and 'application/json' in (request.content_type or ''):
            # JSON mode: use parsed values
            if intervalo_personalizado:
                funcionario_item['intervalo_personalizado'] = True
                try:
                    funcionario_item['intervalo_emp'] = int(intervalo_emp) if intervalo_emp is not None else None
                except Exception:
                    funcionario_item['intervalo_emp'] = None
            else:
                funcionario_item['intervalo_personalizado'] = False
                try:
                    cfg_resp = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
                    cfg = cfg_resp.get('Item', {})
                    if cfg.get('intervalo_automatico', False):
                        funcionario_item['intervalo_emp'] = int(cfg.get('duracao_intervalo', 60))
                    else:
                        funcionario_item['intervalo_emp'] = None
                except Exception:
                    funcionario_item['intervalo_emp'] = None
        else:
            # FormData mode: use extracted form values
            if intervalo_personalizado:
                funcionario_item['intervalo_personalizado'] = True
                funcionario_item['intervalo_emp'] = intervalo_emp if intervalo_emp is not None else None
            else:
                funcionario_item['intervalo_personalizado'] = False
                # Puxar duração padrão da config da empresa (apenas se intervalo automático estiver ativo)
                try:
                    cfg_resp = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
                    cfg = cfg_resp.get('Item', {})
                    if cfg.get('intervalo_automatico', False):
                        funcionario_item['intervalo_emp'] = int(cfg.get('duracao_intervalo', 60))
                    else:
                        funcionario_item['intervalo_emp'] = None
                except Exception:
                    funcionario_item['intervalo_emp'] = None

        # Aplicar regras de horário por dia
        if tipo_horario == 'variavel':
            funcionario_item.pop('horario_entrada', None)
            funcionario_item.pop('horario_saida', None)
            funcionario_item.pop('pred_hora', None)
            funcionario_item.pop('custom_schedule', None)
        else:
            presets = _get_company_presets(empresa_id)
            preset_name = nome_horario or cargo
            preset = _find_preset_by_name(presets, preset_name) if preset_name else None
            if preset:
                _apply_preset_to_employee(funcionario_item, preset)
            elif horario_entrada and horario_saida:
                funcionario_item['custom_schedule'] = build_weekly_from_legacy(horario_entrada, horario_saida)
        
        # Salvar no DynamoDB (Employees table uses company_id as partition key)
        tabela_funcionarios.put_item(Item=funcionario_item)
        
        # Salvar horário pré-definido se fornecido
        if nome_horario and horario_entrada and horario_saida:
            try:
                response = tabela_configuracoes.get_item(
                    Key={'company_id': empresa_id}
                )

                config_item = response.get('Item', {})
                horarios = config_item.get('horarios_preset', [])

                if not isinstance(horarios, list):
                    horarios = []

                horario_existente = next((h for h in horarios if h['nome'] == nome_horario), None)

                if not horario_existente:
                    horario_id = str(uuid.uuid4())
                    horarios.append({
                        'id': horario_id,
                        'nome': nome_horario,
                        'horarios': build_pt_schedule_from_legacy(horario_entrada, horario_saida),
                        'horario_entrada': horario_entrada,
                        'horario_saida': horario_saida,
                        'data_criacao': datetime.now().isoformat()
                    })

                    tabela_configuracoes.update_item(
                        Key={'company_id': empresa_id},
                        UpdateExpression='SET horarios_preset = :hp, updated_at = :ua',
                        ExpressionAttributeValues={
                            ':hp': horarios,
                            ':ua': datetime.now().isoformat()
                        }
                    )
                    print(f"[CADASTRO] Horário pré-definido '{nome_horario}' criado com sucesso")
            except Exception as e:
                print(f"[AVISO] Erro ao salvar horário pré-definido: {e}")
        
        # Limpar arquivo temporário se foi criado
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            "success": True,
            "id": funcionario_id,
            "nome": nome,
            "cargo": cargo,
            "foto_url": foto_url,
            "horario_entrada": horario_entrada,
            "horario_saida": horario_saida,
            "data_cadastro": data_hoje,
            "status": True  # Ativado por padrão
        }), 201

    except Exception as e:
        print(f"Erro ao cadastrar funcionário: {str(e)}")
        return jsonify({"error": str(e)}), 500

@routes.route('/registros', methods=['GET'])
@token_required
def listar_registros(payload):
    data_inicio = request.args.get('inicio')
    data_fim = request.args.get('fim')
    nome_funcionario = request.args.get('nome')
    funcionario_id = request.args.get('funcionario_id')
    
    try:
        # Verificar se é um token de funcionário tentando acessar
        tipo = payload.get('tipo')
        if tipo == 'funcionario':
            return jsonify({'error': 'Acesso negado. Use o endpoint /api/funcionario/registros'}), 403
        
        empresa_id = payload.get('company_id')
        print(f"[DEBUG] empresa_id: {empresa_id}")
        
        if not empresa_id:
            return jsonify({'error': 'Empresa ID não encontrado no token'}), 400
        
        # Buscar configurações da empresa para cálculo de status
        try:
            config_response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
            configuracoes = config_response.get('Item', {})
            print(f"[DEBUG REGISTROS] Configurações da empresa: {configuracoes}")
        except Exception as e:
            print(f"[DEBUG REGISTROS] Erro ao buscar configurações: {e}")
            configuracoes = {}
        
        # Valores padrão para cálculos
        tolerancia_atraso = int(configuracoes.get('tolerancia_atraso', 5))
        intervalo_automatico = configuracoes.get('intervalo_automatico', False)
        duracao_intervalo = int(configuracoes.get('duracao_intervalo', 60))
        
        funcionarios_map = {}  # Cache de funcionários para evitar múltiplas queries
        funcionarios_filtrados = []
        
        # Buscar apenas funcionários da empresa
        try:
            filtro_func = Attr('company_id').eq(empresa_id)
            if nome_funcionario:
                filtro_func = filtro_func & Attr('nome').contains(nome_funcionario)
            
            response_func = tabela_funcionarios.scan(FilterExpression=filtro_func)
            funcionarios_items = response_func.get('Items', [])
            funcionarios_filtrados = [f['id'] for f in funcionarios_items]
            # Criar mapa de funcionários para acesso rápido
            funcionarios_map = {f['id']: f for f in funcionarios_items}
            print(f"[DEBUG] funcionarios_filtrados: {funcionarios_filtrados}")
            
        except Exception as e:
            print(f"[DEBUG] Erro ao buscar funcionários: {str(e)}")
            return jsonify({'error': 'Erro ao buscar funcionários da empresa'}), 500
        
        if funcionario_id:
            # Só permite se o funcionário for da empresa
            if funcionario_id in funcionarios_filtrados:
                funcionarios_filtrados = [funcionario_id]
            else:
                funcionarios_filtrados = []
        
        # Se não houver funcionários na empresa, retornar vazio
        if not funcionarios_filtrados:
            print("[DEBUG] Nenhum funcionário encontrado na empresa")
            return jsonify([])
        
        # Construir filtro de registros para o novo schema TimeRecords
        try:
            # Tabela TimeRecords usa: company_id (HASH) + employee_id#date_time (RANGE)
            filtro_registros = Attr('company_id').eq(empresa_id)
            
            # Adicionar filtro de data se fornecido (formato ISO: YYYY-MM-DD)
            if data_inicio and data_fim:
                # employee_id#date_time formato: "miguel_123#2025-11-10 14:30:00"
                # Precisamos buscar registros entre as datas
                filtro_registros = filtro_registros & Attr('employee_id#date_time').between(
                    f"#{data_inicio} 00:00:00",  # Prefixo com # para pegar qualquer employee_id
                    f"~{data_fim} 23:59:59"      # ~ é maior que qualquer caractere normal
                )
                print(f"[DEBUG] Filtro de data aplicado: {data_inicio} até {data_fim}")
            
            print(f"[DEBUG] Executando scan na tabela TimeRecords...")
            response = tabela_registros.scan(FilterExpression=filtro_registros)
            registros = response.get('Items', [])
            print(f"[DEBUG] Encontrados {len(registros)} registros após scan")
            
            # Debug: mostrar estrutura dos registros
            if registros:
                print(f"[DEBUG] Exemplo de registro (novo schema): {registros[0]}")
            
            # Agrupar registros por funcionário e data para calcular status
            registros_por_func_data = {}
            for reg in registros:
                composite_key = reg.get('employee_id#date_time', '')
                if '#' in composite_key:
                    employee_id, data_hora = composite_key.split('#', 1)
                    data_apenas = data_hora.split(' ')[0]  # YYYY-MM-DD
                    
                    chave = f"{employee_id}#{data_apenas}"
                    if chave not in registros_por_func_data:
                        registros_por_func_data[chave] = []
                    registros_por_func_data[chave].append(reg)
            
            # Converter schema novo para formato esperado pelo frontend
            registros_formatados = []
            
            # Primeiro passo: calcular status para cada par entrada/saída do mesmo dia
            status_por_func_data = {}  # Armazena os status calculados por funcionário/data
            
            for chave, regs_do_dia in registros_por_func_data.items():
                employee_id = chave.split('#')[0]
                date_str = chave.split('#')[1] if '#' in chave else None
                funcionario = funcionarios_map.get(employee_id)
                
                if not funcionario:
                    continue
                    
                try:
                    target_date = datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else None
                except Exception:
                    target_date = None

                if target_date:
                    horario_entrada_esperado, horario_saida_esperado = get_schedule_for_date(funcionario, target_date)
                else:
                    horario_entrada_esperado = funcionario.get('horario_entrada')
                    horario_saida_esperado = funcionario.get('horario_saida')
                
                if not horario_entrada_esperado or not horario_saida_esperado:
                    continue
                
                # Encontrar entrada e saída do dia
                entrada_reg = None
                saida_reg = None
                
                for r in regs_do_dia:
                    r_tipo = r.get('type', r.get('tipo', ''))
                    if r_tipo == 'entrada' and not entrada_reg:
                        entrada_reg = r
                    elif r_tipo in ('saída', 'saida'):
                        saida_reg = r
                
                # Calcular status se temos entrada e saída
                if entrada_reg and saida_reg:
                    try:
                        # Extrair horários reais
                        entrada_key = entrada_reg.get('employee_id#date_time', '')
                        saida_key = saida_reg.get('employee_id#date_time', '')
                        
                        if '#' in entrada_key:
                            _, entrada_data_hora = entrada_key.split('#', 1)
                            horario_entrada_real = entrada_data_hora.split(' ')[1][:5]
                        else:
                            horario_entrada_real = '00:00'
                        
                        if '#' in saida_key:
                            _, saida_data_hora = saida_key.split('#', 1)
                            horario_saida_real = saida_data_hora.split(' ')[1][:5]
                        else:
                            horario_saida_real = '00:00'
                        
                        # Calcular break real se necessário (gap entre 1ª saída e 2ª entrada)
                        dash_break_real = None
                        if not intervalo_automatico:
                            dash_entradas = []
                            dash_saidas = []
                            for r in regs_do_dia:
                                rt = str(r.get('type', r.get('tipo', ''))).lower()
                                rh = r.get('data_hora', '')
                                if rt in ('entrada', 'entry', 'in', 'check-in', 'checkin', 'e'):
                                    dash_entradas.append(rh)
                                elif rt in ('saida', 'saída', 'exit', 'out', 'check-out', 'checkout', 's'):
                                    dash_saidas.append(rh)
                            # Se há 2+ entradas e 1+ saída, o gap é o intervalo
                            if len(dash_saidas) >= 1 and len(dash_entradas) >= 2:
                                try:
                                    bsd = datetime.strptime(dash_saidas[0], '%Y-%m-%d %H:%M:%S')
                                    bed = datetime.strptime(dash_entradas[1], '%Y-%m-%d %H:%M:%S')
                                    dash_break_real = int((bed - bsd).total_seconds() / 60)
                                    if dash_break_real < 0:
                                        dash_break_real = None
                                except:
                                    pass
                        
                        # 3 cases: auto, manual+tem intervalo, manual+sem intervalo
                        dash_func_ti, dash_func_val = _emp_tem_intervalo(funcionario)
                        
                        if intervalo_automatico or dash_func_ti:
                            calculo = calculate_overtime(
                                horario_entrada_esperado,
                                horario_saida_esperado,
                                horario_entrada_real,
                                horario_saida_real,
                                configuracoes,
                                True,
                                dash_func_val if dash_func_ti else duracao_intervalo,
                                None
                            )
                        else:
                            calculo = calculate_overtime(
                                horario_entrada_esperado,
                                horario_saida_esperado,
                                horario_entrada_real,
                                horario_saida_real,
                                configuracoes,
                                False,
                                duracao_intervalo,
                                dash_break_real
                            )
                        
                        # Armazenar status calculado (apenas horas extras e minutos trabalhados)
                        status_por_func_data[chave] = {
                            'horas_extras_minutos': calculo.get('horas_extras_minutos', 0),
                            'horas_trabalhadas_minutos': calculo.get('horas_trabalhadas_minutos', 0)
                        }
                        
                        print(f"[DEBUG CALC] {employee_id}: entrada={horario_entrada_real}, saída={horario_saida_real}, extras={calculo.get('horas_extras_minutos', 0)}")
                    except Exception as calc_err:
                        print(f"[DEBUG] Erro ao calcular status para {employee_id}: {calc_err}")
            
            # Segundo passo: criar registros formatados com status correto
            for reg in registros:
                # Extrair employee_id e data_hora do campo composto
                composite_key = reg.get('employee_id#date_time', '')
                if '#' in composite_key:
                    employee_id, data_hora = composite_key.split('#', 1)
                else:
                    employee_id = reg.get('funcionario_id', '')
                    data_hora = reg.get('data_hora', '')
                
                # Filtrar por funcionário específico se solicitado
                if funcionario_id and employee_id != funcionario_id:
                    continue
                
                # Filtrar por nome se não foi específico por ID
                if not funcionario_id and funcionarios_filtrados and employee_id not in funcionarios_filtrados:
                    continue
                
                # Criar registro formatado para o frontend
                tipo_registro = reg.get('type', reg.get('tipo', ''))
                metodo_registro = reg.get('method', reg.get('metodo', 'MANUAL'))
                
                # Buscar status calculado para este funcionário/data
                data_apenas = data_hora.split(' ')[0]
                chave = f"{employee_id}#{data_apenas}"
                status_calculado = status_por_func_data.get(chave, {})
                
                # Atribuir status ao registro correto:
                # - ENTRADA: atraso e entrada_antecipada
                # - SAÍDA: horas_extras e saida_antecipada
                horas_extras_minutos = 0
                horas_trabalhadas_minutos = 0
                if tipo_registro in ('saída', 'saida'):
                    horas_extras_minutos = status_calculado.get('horas_extras_minutos', 0)
                registro_formatado = {
                    'registro_id': f"{reg.get('company_id', '')}_{composite_key}",
                    'funcionario_id': employee_id,
                    'data_hora': data_hora,
                    'type': tipo_registro,
                    'tipo': tipo_registro,
                    'method': metodo_registro,
                    'horas_extras_minutos': horas_extras_minutos,
                    'status': reg.get('status', 'ATIVO'),
                    'justificativa': reg.get('justificativa', ''),
                    'registro_original_id': reg.get('registro_original_id', ''),
                    'registro_original_key': reg.get('registro_original_key', ''),
                    'invalidado_em': reg.get('invalidado_em', ''),
                    'invalidado_por': reg.get('invalidado_por', ''),
                    'ajustado_por': reg.get('ajustado_por', ''),
                    'criado_por': reg.get('criado_por', ''),
                    'criado_em': reg.get('criado_em', ''),
                }
                
                registros_formatados.append(registro_formatado)
            
            registros = registros_formatados
            print(f"[DEBUG] {len(registros)} registros após formatação e filtros")
            
            # Nome do funcionário já vem no registro do novo schema
            # Mas garantir que está presente em todos
            for reg in registros:
                if not reg.get('funcionario_nome'):
                    func_id = reg.get('funcionario_id')
                    if func_id and func_id in funcionarios_map:
                        reg['funcionario_nome'] = funcionarios_map[func_id].get('nome', 'N/A')
                    elif func_id:
                        try:
                            func_resp = tabela_funcionarios.get_item(
                                Key={'company_id': empresa_id, 'id': func_id}
                            )
                            funcionario = func_resp.get('Item')
                            if funcionario:
                                reg['funcionario_nome'] = funcionario.get('nome', 'N/A')
                            else:
                                reg['funcionario_nome'] = 'N/A'
                        except Exception as e:
                            print(f"[DEBUG] Erro ao buscar nome do funcionário {func_id}: {e}")
                            reg['funcionario_nome'] = 'N/A'
            
        except Exception as e:
            print(f"[DEBUG] Erro no scan de registros: {str(e)}")
            return jsonify({'error': f'Erro ao buscar registros: {str(e)}'}), 500
        
        # Formatar data para DD-MM-AAAA
        for reg in registros:
            if 'data_hora' in reg:
                try:
                    data_part, hora_part = reg['data_hora'].split(' ')
                    yyyy, mm, dd = data_part.split('-')
                    reg['data_hora'] = f"{dd}-{mm}-{yyyy} {hora_part}"
                except (ValueError, IndexError) as e:
                    print(f"[DEBUG] Erro ao formatar data {reg.get('data_hora', 'N/A')}: {str(e)}")
        
        # SEMPRE retornar registros individuais completos
        print(f"[DEBUG] Retornando {len(registros)} registros individuais")
        return jsonify(registros)
            
    except Exception as e:
        print(f"Erro geral ao filtrar registros: {str(e)}")
        return jsonify({'error': 'Erro interno no servidor', 'message': str(e)}), 500

@routes.route('/registros/resumo', methods=['GET'])
@token_required
def listar_registros_resumo(payload):
    """
    Endpoint para retornar resumo agregado de horas trabalhadas, extras e atrasos por funcionário
    """
    data_inicio = request.args.get('inicio')
    data_fim = request.args.get('fim')
    nome_funcionario = request.args.get('nome')
    funcionario_id = request.args.get('funcionario_id')
    
    try:
        # Verificar se é um token de funcionário tentando acessar
        tipo = payload.get('tipo')
        if tipo == 'funcionario':
            return jsonify({'error': 'Acesso negado. Funcionários não podem acessar resumo de outros'}), 403
        
        empresa_id = payload.get('company_id')
        print(f"[DEBUG RESUMO] empresa_id: {empresa_id}")
        
        if not empresa_id:
            return jsonify({'error': 'Empresa ID não encontrado no token'}), 400
        
        # Buscar configurações da empresa
        try:
            config_response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
            configuracoes = config_response.get('Item', {})
            print(f"[DEBUG RESUMO] Configurações: {configuracoes}")
        except Exception as e:
            print(f"[DEBUG RESUMO] Erro ao buscar configurações: {e}")
            configuracoes = {}
        
        # Valores padrão
        tolerancia_atraso = int(configuracoes.get('tolerancia_atraso', 5))
        hora_extra_entrada_antecipada = configuracoes.get('hora_extra_entrada_antecipada', False)
        # Tratamento robusto para o campo de arredondamento: pode ser 'exato' ou valores numéricos em string
        arredondamento_raw = configuracoes.get('arredondamento_horas_extras', 5)
        try:
            # 'exato' será tratado como 0 (sem arredondamento)
            if isinstance(arredondamento_raw, str) and arredondamento_raw.lower() == 'exato':
                arredondamento_horas_extras = 0
            else:
                arredondamento_horas_extras = int(arredondamento_raw)
        except Exception:
            print(f"[DEBUG RESUMO] Valor de arredondamento inválido: {arredondamento_raw}, usando padrão 5")
            arredondamento_horas_extras = 5
        intervalo_automatico = configuracoes.get('intervalo_automatico', False)
        duracao_intervalo = int(configuracoes.get('duracao_intervalo', 60))
        
        funcionarios_filtrados = []
        
        # Buscar funcionários da empresa
        try:
            filtro_func = Attr('company_id').eq(empresa_id)
            if nome_funcionario:
                filtro_func = filtro_func & Attr('nome').contains(nome_funcionario)
            
            response_func = tabela_funcionarios.scan(FilterExpression=filtro_func)
            funcionarios_filtrados = response_func.get('Items', [])
            print(f"[DEBUG RESUMO] Funcionários encontrados: {len(funcionarios_filtrados)}")
        except Exception as e:
            print(f"[DEBUG RESUMO] Erro ao buscar funcionários: {str(e)}")
            return jsonify({'error': 'Erro ao buscar funcionários da empresa'}), 500
        
        # Filtrar por funcionario_id se fornecido
        if funcionario_id:
            funcionarios_filtrados = [f for f in funcionarios_filtrados if f['id'] == funcionario_id]
        
        if not funcionarios_filtrados:
            print("[DEBUG RESUMO] Nenhum funcionário encontrado")
            return jsonify([])
        
        # Buscar TODOS os registros da empresa no período com paginação completa
        try:
            print(f"[DEBUG RESUMO] Iniciando busca de registros - Período: {data_inicio} até {data_fim}")
            func_ids_set = set(f['id'] for f in funcionarios_filtrados)
            print(f"[DEBUG RESUMO] Buscando para {len(func_ids_set)} funcionários")
            
            # Montar filtro base
            base_filter = Attr('company_id').eq(empresa_id)
            if data_inicio and data_fim:
                start_ts = f"{data_inicio} 00:00:00"
                end_ts = f"{data_fim} 23:59:59"
                date_filter = Attr('data_hora').between(start_ts, end_ts)
                scan_filter = base_filter & date_filter
            else:
                scan_filter = base_filter
            
            # Scan com paginação completa (sem Limit)
            registros_raw = []
            scan_kwargs = {'FilterExpression': scan_filter}
            while True:
                response = tabela_registros.scan(**scan_kwargs)
                items = response.get('Items', [])
                registros_raw.extend(items)
                # Verificar se há mais páginas
                last_key = response.get('LastEvaluatedKey')
                if not last_key:
                    break
                scan_kwargs['ExclusiveStartKey'] = last_key
            
            print(f"[DEBUG RESUMO] Registros raw encontrados (scan completo): {len(registros_raw)}")
            
            # Filtrar por employee_id e status
            registros = []
            for item in registros_raw:
                # Ignorar registros invalidados ou ajustados
                record_status = (item.get('status') or 'ATIVO').upper()
                if record_status in ('INVALIDADO', 'AJUSTADO'):
                    continue
                
                # Determinar employee_id do registro
                employee_id = item.get('employee_id')
                if not employee_id:
                    composite = item.get('employee_id#date_time') or ''
                    if '#' in composite:
                        employee_id = composite.split('#')[0]
                
                # Verificar se pertence a um funcionário filtrado
                if not employee_id or str(employee_id) not in func_ids_set:
                    continue
                
                # Extrair campos
                data_hora = item.get('data_hora') or item.get('date_time')
                data_hora_calculo = item.get('data_hora_calculo') or data_hora
                tipo = item.get('type') or item.get('tipo')
                
                # Normalizar data para DD-MM-YYYY HH:MM:SS
                data_hora_formatada = data_hora
                data_hora_calculo_fmt = data_hora_calculo
                if data_hora:
                    try:
                        if '-' in data_hora:
                            partes = data_hora.split(' ')
                            if len(partes) >= 2:
                                data_part, hora_part = partes[0], partes[1]
                                split = data_part.split('-')
                                if len(split) == 3 and len(split[0]) == 4:
                                    yyyy, mm, dd = split
                                    data_hora_formatada = f"{dd}-{mm}-{yyyy} {hora_part}"
                    except Exception as e:
                        print(f"[DEBUG RESUMO] Erro ao formatar data {data_hora}: {e}")
                
                if data_hora_calculo and data_hora_calculo != data_hora:
                    try:
                        if '-' in data_hora_calculo:
                            partes = data_hora_calculo.split(' ')
                            if len(partes) >= 2:
                                data_part, hora_part = partes[0], partes[1]
                                split = data_part.split('-')
                                if len(split) == 3 and len(split[0]) == 4:
                                    yyyy, mm, dd = split
                                    data_hora_calculo_fmt = f"{dd}-{mm}-{yyyy} {hora_part}"
                    except Exception:
                        data_hora_calculo_fmt = data_hora_formatada
                else:
                    data_hora_calculo_fmt = data_hora_formatada
                
                registro_formatado = {
                    'employee_id': str(employee_id),
                    'data_hora': data_hora_formatada,
                    'data_hora_calculo': data_hora_calculo_fmt,
                    'tipo': tipo,
                }
                registros.append(registro_formatado)
            
            print(f"[DEBUG RESUMO] Registros filtrados e formatados: {len(registros)}")
        except Exception as e:
            print(f"[DEBUG RESUMO] Erro ao buscar registros: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'Erro ao buscar registros: {str(e)}'}), 500
        
        # Agrupar registros por funcionário e data
        registros_por_funcionario_data = {}
        for reg in registros:
            func_id = reg.get('employee_id')
            data_hora_completa = reg.get('data_hora', '')
            if not func_id or not data_hora_completa:
                continue
            data = data_hora_completa.split(' ')[0]  # DD-MM-YYYY
            if func_id not in registros_por_funcionario_data:
                registros_por_funcionario_data[func_id] = {}
            if data not in registros_por_funcionario_data[func_id]:
                registros_por_funcionario_data[func_id][data] = []
            registros_por_funcionario_data[func_id][data].append(reg)
        
        # Calcular resumo para cada funcionário (OTIMIZADO)
        resultado_resumo = []
        
        print(f"[DEBUG RESUMO] Calculando resumo para {len(funcionarios_filtrados)} funcionários")
        
        # Limitar processamento para evitar timeout
        max_funcionarios = 50  # Aumentado para 50 funcionários  
        funcionarios_processados = 0
        
        for funcionario in funcionarios_filtrados:
            # Parar se atingir limite
            if funcionarios_processados >= max_funcionarios:
                print(f"[DEBUG RESUMO] Limite de {max_funcionarios} funcionários atingido")
                break
                
            func_id = funcionario['id']
            func_nome = funcionario.get('nome', 'Desconhecido')
            
            print(f"[DEBUG RESUMO] Processando funcionário: {func_nome} ({func_id})")
            
            total_horas_trabalhadas_min = 0
            total_horas_extras_min = 0
            total_atrasos_min = 0
            
            # Se o funcionário tem registros
            if func_id in registros_por_funcionario_data:
                for data, regs_do_dia in registros_por_funcionario_data[func_id].items():
                    # Ordenar registros por hora
                    regs_do_dia.sort(key=lambda x: x.get('data_hora', ''))
                    
                    # Encontrar primeira entrada, última saída, e gap entre pares (intervalo)
                    entrada = None
                    saida = None
                    all_entradas = []
                    all_saidas = []

                    def _normalize_type(t):
                        if not t:
                            return ''
                        s = str(t).strip().lower()
                        s = s.replace('á', 'a').replace('ã', 'a').replace('â', 'a')
                        s = s.replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
                        s = s.replace('é', 'e').replace('ê', 'e').replace('ô', 'o')
                        return s

                    for reg in regs_do_dia:
                        reg_tipo = _normalize_type(reg.get('tipo') or reg.get('type') or '')
                        is_entry = reg_tipo in ('entrada', 'in') or reg_tipo.startswith('entrada') or 'entry' in reg_tipo
                        is_exit = reg_tipo in ('saida', 'saida', 'out') or reg_tipo.startswith('saida') or 'out' in reg_tipo

                        hora_para_calculo = reg.get('data_hora_calculo') or reg.get('data_hora', '')

                        if is_entry:
                            all_entradas.append(hora_para_calculo)
                            if not entrada:
                                entrada = hora_para_calculo
                        if is_exit:
                            all_saidas.append(hora_para_calculo)
                            saida = hora_para_calculo
                    
                    # Para funcionários sem intervalo_emp: o gap entre 1ª saída e 2ª entrada É o intervalo
                    # Requer 2+ entradas E 2+ saídas (ciclo completo: E-S-E-S)
                    break_start_hora = all_saidas[0] if len(all_saidas) >= 2 and len(all_entradas) >= 2 else None
                    break_end_hora = all_entradas[1] if len(all_entradas) >= 2 and len(all_saidas) >= 2 else None
                    
                    if entrada and saida:
                        try:
                            try:
                                target_date = datetime.strptime(data, '%d-%m-%Y').date()
                            except Exception:
                                try:
                                    target_date = datetime.strptime(data, '%Y-%m-%d').date()
                                except Exception:
                                    target_date = None

                            if target_date:
                                horario_entrada_esperado, horario_saida_esperado = get_schedule_for_date(funcionario, target_date)
                            else:
                                horario_entrada_esperado = funcionario.get('horario_entrada')
                                horario_saida_esperado = funcionario.get('horario_saida')

                            def _try_parse_dt(value):
                                for fmt in ('%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
                                    try:
                                        return datetime.strptime(value, fmt)
                                    except Exception:
                                        continue
                                try:
                                    return datetime.fromisoformat(value)
                                except Exception:
                                    raise ValueError(f"Formato de data inesperado: {value}")

                            entrada_dt = _try_parse_dt(entrada)
                            saida_dt = _try_parse_dt(saida)
                            
                            # ============================================================
                            # CÁLCULO COM TOLERÂNCIA (mesma lógica do routes_daily.py)
                            # ============================================================
                            # - Entrada dentro da tolerância → arredonda para horário padrão
                            # - Entrada além da tolerância → usa horário real
                            # - Saída dentro da tolerância → arredonda para horário padrão
                            # - Saída além da tolerância → horas totais até horário padrão,
                            #   excedente = hora extra
                            # ============================================================
                            
                            horas_extras_min = 0
                            atraso_min = 0
                            
                            if horario_entrada_esperado and horario_saida_esperado:
                                try:
                                    # Parse horários esperados para o mesmo dia
                                    data_parte = entrada_dt.strftime('%Y-%m-%d')
                                    entrada_esperada = datetime.strptime(f"{data_parte} {horario_entrada_esperado}", '%Y-%m-%d %H:%M')
                                    saida_esperada = datetime.strptime(f"{data_parte} {horario_saida_esperado}", '%Y-%m-%d %H:%M')
                                    
                                    # Determinar início efetivo
                                    diff_entrada_min = int((entrada_dt - entrada_esperada).total_seconds() / 60)
                                    if abs(diff_entrada_min) <= tolerancia_atraso:
                                        # Dentro da tolerância: arredondar para horário padrão
                                        inicio_efetivo = entrada_esperada
                                    elif diff_entrada_min > tolerancia_atraso:
                                        # Atrasado além da tolerância: usa horário real
                                        inicio_efetivo = entrada_dt
                                        atraso_min = diff_entrada_min
                                    else:
                                        # Antecipado além da tolerância: usa horário real
                                        inicio_efetivo = entrada_dt
                                    
                                    # Determinar fim efetivo
                                    diff_saida_min = int((saida_dt - saida_esperada).total_seconds() / 60)
                                    if abs(diff_saida_min) <= tolerancia_atraso:
                                        # Dentro da tolerância: arredondar para horário padrão
                                        fim_efetivo = saida_esperada
                                    elif diff_saida_min > tolerancia_atraso:
                                        # Saiu depois da tolerância: total até horário padrão, excedente = extra
                                        fim_efetivo = saida_esperada
                                        horas_extras_min = diff_saida_min
                                    else:
                                        # Saiu antes além da tolerância: usa horário real
                                        fim_efetivo = saida_dt
                                    
                                    # Horas extras por entrada antecipada (se configurado)
                                    if hora_extra_entrada_antecipada and entrada_dt < entrada_esperada:
                                        antecipacao_min = int((entrada_esperada - entrada_dt).total_seconds() / 60)
                                        if antecipacao_min > tolerancia_atraso:
                                            horas_extras_min += antecipacao_min
                                    
                                    # Calcular horas trabalhadas
                                    minutos_trabalhados = int((fim_efetivo - inicio_efetivo).total_seconds() / 60)
                                    
                                    # Descontar intervalo
                                    # Funcionário COM intervalo → desconta fixo
                                    # Funcionário SEM intervalo → desconta gap real das batidas
                                    func_tem_intervalo, func_intervalo_val = _emp_tem_intervalo(funcionario)
                                    
                                    if func_tem_intervalo and func_intervalo_val > 0:
                                        if minutos_trabalhados > func_intervalo_val:
                                            minutos_trabalhados -= func_intervalo_val
                                    elif not func_tem_intervalo and break_start_hora and break_end_hora:
                                        # Sem intervalo pré-definido: gap entre 1ª saída e 2ª entrada
                                        try:
                                            bs_dt = _try_parse_dt(break_start_hora)
                                            be_dt = _try_parse_dt(break_end_hora)
                                            break_real_min = int((be_dt - bs_dt).total_seconds() / 60)
                                            if break_real_min > 0 and break_real_min < minutos_trabalhados:
                                                minutos_trabalhados -= break_real_min
                                        except Exception as brk_err:
                                            print(f"[DEBUG RESUMO] Erro ao calcular intervalo real: {brk_err}")
                                    
                                    if minutos_trabalhados < 0:
                                        minutos_trabalhados = 0
                                    
                                    print(f"[DEBUG RESUMO] {func_nome} dia {data}: entrada={entrada_dt.strftime('%H:%M')}, saida={saida_dt.strftime('%H:%M')}, "
                                          f"esperado={horario_entrada_esperado}-{horario_saida_esperado}, tol={tolerancia_atraso}, "
                                          f"inicio_efetivo={inicio_efetivo.strftime('%H:%M')}, fim_efetivo={fim_efetivo.strftime('%H:%M')}, "
                                          f"trabalhado={minutos_trabalhados}min, extras={horas_extras_min}min")
                                    
                                    total_horas_trabalhadas_min += minutos_trabalhados
                                    total_horas_extras_min += horas_extras_min
                                    total_atrasos_min += atraso_min
                                    
                                except Exception as e:
                                    print(f"[DEBUG RESUMO] Erro ao processar horários esperados: {e}")
                                    import traceback
                                    traceback.print_exc()
                                    # Fallback: calcular bruto
                                    horas_brutas_min = int((saida_dt - entrada_dt).total_seconds() / 60)
                                    fb_tem_intervalo, fb_intervalo_val = _emp_tem_intervalo(funcionario)
                                    if fb_tem_intervalo and fb_intervalo_val > 0:
                                        horas_brutas_min = max(0, horas_brutas_min - fb_intervalo_val)
                                    elif not fb_tem_intervalo and break_start_hora and break_end_hora:
                                        try:
                                            bs_dt2 = _try_parse_dt(break_start_hora)
                                            be_dt2 = _try_parse_dt(break_end_hora)
                                            brk_min = int((be_dt2 - bs_dt2).total_seconds() / 60)
                                            if brk_min > 0:
                                                horas_brutas_min = max(0, horas_brutas_min - brk_min)
                                        except Exception:
                                            pass
                                    total_horas_trabalhadas_min += horas_brutas_min
                            else:
                                # Sem horários esperados: calcular bruto
                                horas_brutas_min = int((saida_dt - entrada_dt).total_seconds() / 60)
                                nh_tem_intervalo, nh_intervalo_val = _emp_tem_intervalo(funcionario)
                                if nh_tem_intervalo and nh_intervalo_val > 0:
                                    horas_brutas_min = max(0, horas_brutas_min - nh_intervalo_val)
                                elif not nh_tem_intervalo and break_start_hora and break_end_hora:
                                    try:
                                        bs_dt3 = _try_parse_dt(break_start_hora)
                                        be_dt3 = _try_parse_dt(break_end_hora)
                                        brk_min3 = int((be_dt3 - bs_dt3).total_seconds() / 60)
                                        if brk_min3 > 0:
                                            horas_brutas_min = max(0, horas_brutas_min - brk_min3)
                                    except Exception:
                                        pass
                                total_horas_trabalhadas_min += horas_brutas_min
                        
                        except Exception as e:
                            print(f"[DEBUG RESUMO] Erro ao calcular horas para {func_id} em {data}: {str(e)}")
            
            # Calcular total de registros
            total_registros = sum(len(regs_do_dia) for regs_do_dia in registros_por_funcionario_data.get(func_id, {}).values())
            
            # Formatar para HH:MM
            def min_para_hhmm(minutos):
                horas = minutos // 60
                mins = minutos % 60
                return f"{horas:02d}:{mins:02d}"
            
            resultado_resumo.append({
                'funcionario_id': func_id,
                'funcionario_nome': func_nome,
                'horas_trabalhadas': min_para_hhmm(total_horas_trabalhadas_min),
                'horas_extras': min_para_hhmm(total_horas_extras_min),
                'horas_trabalhadas_minutos': total_horas_trabalhadas_min,
                'horas_extras_minutos': total_horas_extras_min,
                'atraso_minutos': total_atrasos_min,
                'total_registros': total_registros
            })
            
            funcionarios_processados += 1
        
        print(f"[DEBUG RESUMO] Retornando resumo com {len(resultado_resumo)} funcionários")
        return jsonify(resultado_resumo)
    
    except Exception as e:
        print(f"[DEBUG RESUMO] Erro geral: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Erro interno no servidor', 'message': str(e)}), 500

@routes.route('/funcionarios', methods=['GET'])
@token_required
def listar_funcionarios(payload):
    """
    Retorna lista de funcionários da empresa do usuário autenticado
    """
    try:
        empresa_id = payload.get('company_id')
        if not empresa_id:
            return jsonify({'error': 'Empresa ID não encontrado no token'}), 400
        filtro_func = Attr('company_id').eq(empresa_id)
        response_func = tabela_funcionarios.scan(FilterExpression=filtro_func)
        funcionarios = response_func.get('Items', [])
        # Padronizar para id/nome
        # Retornar todos os campos relevantes de cada funcionário
        funcionarios_list = []
        for f in funcionarios:
            funcionario_dict = {
                'id': f.get('id'),
                'nome': f.get('nome', ''),
                'cargo': f.get('cargo'),
                'foto_url': f.get('foto_url'),
                'data_cadastro': f.get('data_cadastro'),
                'horario_entrada': f.get('horario_entrada'),
                'horario_saida': f.get('horario_saida'),
                'ativo': f.get('ativo', f.get('is_active', True)),
                'face_id': f.get('face_id'),
                'empresa_nome': f.get('empresa_nome'),
                'empresa_id': f.get('empresa_id', f.get('company_id')),
                'login': f.get('login'),
                'intervalo_personalizado': f.get('intervalo_personalizado', False),
                'intervalo_emp': f.get('intervalo_emp'),
                'tolerancia_atraso': f.get('tolerancia_atraso'),
                'custom_schedule': f.get('custom_schedule'),
            }
            funcionarios_list.append(funcionario_dict)
        return jsonify({'funcionarios': funcionarios_list})
    except Exception as e:
        print(f"[FUNCIONARIOS] Erro ao buscar funcionários: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Erro ao buscar funcionários', 'message': str(e)}), 500
@token_required
def buscar_nomes(payload):
    nome_parcial = request.args.get('nome', '')
    try:
        empresa_id = payload.get('company_id')
        response = tabela_funcionarios.scan(
            FilterExpression=Attr('company_id').eq(empresa_id) & Attr('nome').contains(nome_parcial)
        )
        nomes = [funcionario['nome'] for funcionario in response['Items']]
        return jsonify(nomes)
    except Exception as e:
        print(f"Erro ao buscar nomes: {str(e)}")
        return jsonify({'error': 'Erro ao buscar nomes'}), 500

@routes.route('/enviar-email-registros', methods=['POST'])
def enviar_email_registros():
    try:
        from io import BytesIO
        from openpyxl import Workbook
        
        # ✅ CORREÇÃO: Usar request.get_json() em vez de request.json
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON inválido ou ausente'}), 400
            
        funcionario = data.get('funcionario', 'Funcionário não especificado')
        periodo = data.get('periodo', 'Período não especificado')
        registros = data.get('registros', [])
        email_destino = data.get('email')
        if not email_destino:
            return jsonify({'error': 'Email não fornecido'}), 400
            
        output = BytesIO()
        workbook = Workbook()
        sheet_resumo = workbook.active
        sheet_resumo.title = "Resumo"
        sheet_resumo.append(["Relatório de Registros de Ponto"])
        sheet_resumo.append(["Funcionário:", funcionario])
        sheet_resumo.append(["Período:", periodo])
        sheet_resumo.append([])
        sheet_resumo.append(["Total de Registros:", len(registros)])
        sheet_detalhes = workbook.create_sheet("Registros")
        sheet_detalhes.append(["Data", "Hora", "Tipo"])
        for reg in registros:
            emp_id = reg.get('employee_id')
            data_hora_completa = reg.get('data_hora', '')
            if not emp_id or not data_hora_completa:
                continue
            data = data_hora_completa.split(' ')[0]  # DD-MM-YYYY
            if emp_id not in registros_por_funcionario_data:
                registros_por_funcionario_data[emp_id] = {}
            if data not in registros_por_funcionario_data[emp_id]:
                registros_por_funcionario_data[emp_id][data] = []
            registros_por_funcionario_data[emp_id][data].append(reg)
    except Exception as e:
        print(f"Erro ao enviar email: {str(e)}")
        return jsonify({'error': str(e)}), 500

@routes.route('/registros/<registro_id>/ajustar', methods=['POST', 'OPTIONS'])
@token_required
def ajustar_registro(payload, registro_id):
    """Cria um novo registro de ajuste vinculado ao original.
    O registro original recebe status AJUSTADO.
    O novo registro recebe status ATIVO e referência ao original.
    Justificativa obrigatória.
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON inválido ou ausente'}), 400
    
    justificativa = (data.get('justificativa') or '').strip()
    if not justificativa:
        return jsonify({'error': 'Justificativa é obrigatória para ajustar um registro'}), 400
    
    nova_data_hora = data.get('data_hora')  # Nova data/hora corrigida
    novo_tipo = data.get('tipo')  # Tipo pode mudar (entrada/saída)
    
    if not nova_data_hora:
        return jsonify({'error': 'Nova data/hora é obrigatória'}), 400
    
    company_id = payload.get('company_id')
    if not company_id:
        return jsonify({'error': 'Company ID não encontrado no token'}), 400
    
    try:
        # Localizar o registro original
        composite_key = None
        parts = registro_id.split('_')
        if len(parts) < 2:
            return jsonify({'error': 'Formato de registro_id inválido'}), 400
        extracted_company_id = parts[0]
        remaining = '_'.join(parts[1:])
        if '#' in remaining:
            composite_key = remaining
        else:
            response = tabela_registros.query(
                KeyConditionExpression=Key('company_id').eq(company_id) & Key('employee_id#date_time').begins_with(f"{remaining}#")
            )
            items = response.get('Items', [])
            if not items:
                return jsonify({'error': 'Registro original não encontrado'}), 404
            composite_key = items[0].get('employee_id#date_time', None)
        
        if not composite_key:
            return jsonify({'error': 'Chave do registro não encontrada'}), 400
        
        if extracted_company_id != company_id:
            return jsonify({'error': 'Acesso negado'}), 403
        
        # Buscar registro original
        verify_response = tabela_registros.get_item(Key={
            'company_id': company_id,
            'employee_id#date_time': composite_key
        })
        if 'Item' not in verify_response:
            return jsonify({'error': 'Registro original não encontrado'}), 404
        
        registro_original = verify_response['Item']
        employee_id = registro_original.get('employee_id')
        tipo_final = novo_tipo or registro_original.get('type', registro_original.get('tipo', 'entrada'))
        
        # 1. Marcar registro original como AJUSTADO
        tabela_registros.update_item(
            Key={
                'company_id': company_id,
                'employee_id#date_time': composite_key
            },
            UpdateExpression='SET #status = :status, ajustado_em = :now, ajustado_por = :user, justificativa_ajuste = :justificativa',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'AJUSTADO',
                ':now': datetime.now().isoformat(),
                ':user': payload.get('usuario_id', payload.get('email', 'admin')),
                ':justificativa': justificativa
            }
        )
        
        # 2. Criar novo registro vinculado ao original
        novo_id = str(uuid.uuid4())
        novo_sort_key = f"{employee_id}#{nova_data_hora}"
        
        novo_registro = {
            'company_id': company_id,
            'employee_id#date_time': novo_sort_key,
            'registro_id': novo_id,
            'employee_id': employee_id,
            'data_hora': nova_data_hora,
            'data_hora_calculo': nova_data_hora,
            'type': tipo_final,
            'method': 'AJUSTE',
            'status': 'ATIVO',
            'justificativa': justificativa,
            'registro_original_id': registro_original.get('registro_id', ''),
            'registro_original_key': composite_key,
            'ajustado_por': payload.get('usuario_id', payload.get('email', 'admin')),
            'criado_em': datetime.now().isoformat(),
            'funcionario_nome': registro_original.get('funcionario_nome', ''),
            'empresa_nome': registro_original.get('empresa_nome', '')
        }
        
        tabela_registros.put_item(Item=novo_registro)
        
        print(f"[AJUSTE REGISTRO] ✅ Registro original {composite_key} marcado como AJUSTADO. Novo registro criado: {novo_sort_key}")
        return jsonify({
            'success': True,
            'message': 'Registro ajustado com sucesso',
            'novo_registro_id': novo_id
        }), 200
    except Exception:
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Erro ao ajustar registro'}), 500


@routes.route('/registrar_ponto_manual', methods=['POST'])
@token_required
def registrar_ponto_manual(payload):
    # ✅ CORREÇÃO: Usar request.get_json() em vez de request.data
    data = request.get_json()
    if not data:
        return jsonify({'mensagem': 'JSON inválido ou ausente'}), 400
        
    employee_id = data.get('employee_id') or data.get('funcionario_id')
    data_hora = data.get('data_hora')  # Formato: 'YYYY-MM-DD HH:MM'
    tipo = data.get('tipo')
    justificativa = (data.get('justificativa') or '').strip()
    
    if not employee_id or not data_hora or not tipo:
        return jsonify({'mensagem': 'Funcionário, data/hora e tipo são obrigatórios'}), 400
    
    if not justificativa:
        return jsonify({'mensagem': 'Justificativa é obrigatória para registro manual'}), 400
        
    # Verifica se o funcionário existe e se pertence à empresa do usuário
    empresa_nome = payload.get('empresa_nome')
    empresa_id = payload.get('company_id')
    # Tabela Employees usa company_id + id como chave composta
    response = tabela_funcionarios.get_item(Key={'company_id': empresa_id, 'id': employee_id})
    funcionario = response.get('Item')
    if not funcionario:
        return jsonify({'mensagem': 'Funcionário não encontrado'}), 404
    
    # Verificar se funcionário está ativo (exclusão lógica)
    is_active = funcionario.get('is_active', funcionario.get('ativo', True))
    if not is_active:
        return jsonify({
            'mensagem': 'Funcionário inativo. Não é possível registrar ponto.',
            'deleted_at': funcionario.get('deleted_at')
        }), 403
        
    id_registro = str(uuid.uuid4())
    
    # Tabela TimeRecords usa: company_id (HASH) + employee_id#date_time (RANGE)
    sort_key = f"{employee_id}#{data_hora}"
    
    # Buscar configurações da empresa
    config_response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
    configuracoes = config_response.get('Item', {
        'tolerancia_atraso': 5,
        'hora_extra_entrada_antecipada': False,
        'arredondamento_horas_extras': '5',
        'intervalo_automatico': False,
        'duracao_intervalo': 60
    })

    # Ajuste de tolerância de atraso para ENTRADA
    # IMPORTANTE: Manter horário real para exibição, mas calcular horário arredondado para cálculos
    data_hora_calculo = data_hora  # Por padrão, o horário de cálculo é igual ao real

    if tipo == 'entrada':
        try:
            data_str, _ = data_hora.split(' ')
            target_date = datetime.strptime(data_str, '%Y-%m-%d').date()
        except Exception:
            target_date = None
        if target_date:
            horario_entrada_esperado, _ = get_schedule_for_date(funcionario, target_date)
        else:
            horario_entrada_esperado = funcionario.get('horario_entrada')
        tolerancia_atraso = int(configuracoes.get('tolerancia_atraso', 5))
        if horario_entrada_esperado:
            data_str, hora_str = data_hora.split(' ')
            # Aceita tanto HH:MM quanto HH:MM:SS
            def parse_hora(h):
                try:
                    return datetime.strptime(h, '%H:%M')
                except Exception:
                    return datetime.strptime(h, '%H:%M:%S')
            # Monta data completa para comparar
            try:
                entrada_real = datetime.strptime(data_hora, '%Y-%m-%d %H:%M')
            except ValueError:
                entrada_real = datetime.strptime(data_hora, '%Y-%m-%d %H:%M:%S')
            # Monta horário esperado completo
            try:
                entrada_esperada = datetime.strptime(f"{data_str} {horario_entrada_esperado}", '%Y-%m-%d %H:%M')
            except ValueError:
                entrada_esperada = datetime.strptime(f"{data_str} {horario_entrada_esperado}", '%Y-%m-%d %H:%M:%S')
            diff_min = int((entrada_real - entrada_esperada).total_seconds() // 60)
            if diff_min <= tolerancia_atraso:
                # Dentro da tolerância: arredonda o horário de CÁLCULO (não o exibido)
                data_hora_calculo = f"{data_str} {horario_entrada_esperado}"
                print(f"[REGISTRO MANUAL] Entrada dentro da tolerância ({diff_min}min). Arredondando cálculo para {horario_entrada_esperado}")
            # Se passar da tolerância, atraso será calculado normalmente

    # Preparar o registro base
    registro = {
        'company_id': empresa_id,           # Partition key
        'employee_id#date_time': sort_key,  # Sort key
        'registro_id': id_registro,
        'employee_id': employee_id,
        'data_hora': data_hora,             # Horário real exibido ao usuário
        'data_hora_calculo': data_hora_calculo,  # Horário arredondado para cálculos
        'type': tipo,  # Padronizado para 'type'
        'method': 'MANUAL',  # Método de registro manual
        'status': 'ATIVO',  # Status do registro
        'justificativa': justificativa,  # Justificativa obrigatória para registro manual
        'criado_por': payload.get('usuario_id', payload.get('email', 'admin')),
        'funcionario_nome': funcionario.get('nome', ''),
        'empresa_nome': empresa_nome
    }
    
    # Se for saída, calcular horas extras
    if tipo == 'saída':
        try:
            # Buscar configurações da empresa
            config_response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
            
            configuracoes = config_response.get('Item', {
                'tolerancia_atraso': 5,
                'hora_extra_entrada_antecipada': False,
                'arredondamento_horas_extras': '5',
                'intervalo_automatico': False,
                'duracao_intervalo': 60
            })
            
            # Pegar horários esperados do funcionário
            try:
                data_registro = data_hora.split(' ')[0]
                target_date = datetime.strptime(data_registro, '%Y-%m-%d').date()
            except Exception:
                target_date = None

            if target_date:
                horario_entrada_esperado, horario_saida_esperado = get_schedule_for_date(funcionario, target_date)
            else:
                horario_entrada_esperado = funcionario.get('horario_entrada')
                horario_saida_esperado = funcionario.get('horario_saida')
            
            # Buscar registros do mesmo dia para encontrar a entrada
            data_registro = data_hora.split(' ')[0]  # YYYY-MM-DD
            response_registros = tabela_registros.scan(
                FilterExpression=Attr('employee_id').eq(employee_id) & Attr('data_hora').begins_with(data_registro)
            )
            registros_do_dia = sorted(response_registros.get('Items', []), key=lambda x: x['data_hora'])
            
            if registros_do_dia and horario_entrada_esperado and horario_saida_esperado:
                # Pegar horários reais
                horario_entrada_real = registros_do_dia[0]['data_hora'].split(' ')[1][:5]  # HH:MM
                horario_saida_real = data_hora.split(' ')[1][:5]  # HH:MM
                
                # Calcular break real se manual (gap entre 1ª saída e 2ª entrada)
                loc_break_real = None
                loc_is_auto = configuracoes.get('intervalo_automatico', False)
                if not loc_is_auto:
                    manual_entradas = []
                    manual_saidas = []
                    for r in registros_do_dia:
                        rt = str(r.get('type', r.get('tipo', ''))).lower()
                        rh = r.get('data_hora', '')
                        if rt in ('entrada', 'entry', 'in', 'check-in', 'checkin', 'e'):
                            manual_entradas.append(rh)
                        elif rt in ('saida', 'saída', 'exit', 'out', 'check-out', 'checkout', 's'):
                            manual_saidas.append(rh)
                    # Se há 2+ entradas e 1+ saída, gap = intervalo
                    if len(manual_saidas) >= 1 and len(manual_entradas) >= 2:
                        try:
                            bsd = datetime.strptime(manual_saidas[0], '%Y-%m-%d %H:%M:%S')
                            bed = datetime.strptime(manual_entradas[1], '%Y-%m-%d %H:%M:%S')
                            loc_break_real = int((bed - bsd).total_seconds() / 60)
                            if loc_break_real < 0:
                                loc_break_real = None
                        except:
                            pass
                
                loc_func_ti, loc_func_val = _emp_tem_intervalo(funcionario)
                
                if loc_is_auto or loc_func_ti:
                    calculo = calculate_overtime(
                        horario_entrada_esperado,
                        horario_saida_esperado,
                        horario_entrada_real,
                        horario_saida_real,
                        configuracoes,
                        True,
                        loc_func_val if loc_func_ti else int(configuracoes.get('duracao_intervalo', 60)),
                        None
                    )
                else:
                    calculo = calculate_overtime(
                        horario_entrada_esperado,
                        horario_saida_esperado,
                        horario_entrada_real,
                        horario_saida_real,
                        configuracoes,
                        False,
                        configuracoes.get('duracao_intervalo', 60),
                        loc_break_real
                    )
                
                # Adicionar informações ao registro (apenas horas extras e trabalhadas)
                registro['horas_extras_minutos'] = calculo['horas_extras_minutos']
                registro['horas_trabalhadas_minutos'] = calculo['horas_trabalhadas_minutos']
                registro['horas_extras_formatado'] = format_minutes_to_time(calculo['horas_extras_minutos'])
        except Exception as e:
            print(f"Erro ao calcular horas extras no ponto manual: {str(e)}")
            # Continua o registro mesmo se falhar o cálculo
    
    # Salva no DynamoDB
    tabela_registros.put_item(Item=registro)
    return jsonify({'mensagem': f'Ponto manual registrado como {tipo} com sucesso'}), 200

@routes.route('/registros_protegido', methods=['GET'])
@token_required
def listar_registros_protegido(payload):
    company_id = payload.get("company_id")
    # Exemplo de implementação simples para buscar registros por company_id
    response = tabela_registros.scan(
        FilterExpression=Attr('company_id').eq(company_id)
    )
    registros = response.get('Items', [])
    return jsonify(registros)

@routes.route('/login', methods=['POST', 'OPTIONS'])
def login():
    """Login exclusivo para empresas usando credenciais da tabela UserCompany."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    from utils.auth import verify_password, get_secret_key
    import datetime
    import jwt

    try:
        # Log de debug
        print(f"[LOGIN] ========== REQUEST DEBUG ==========")
        print(f"[LOGIN] Content-Type: {request.content_type}")
        print(f"[LOGIN] Method: {request.method}")
        print(f"[LOGIN] Raw data (primeiros 500 chars): {request.get_data(as_text=True)[:500]}")
        
        data = request.get_json(force=True, silent=False)
        print(f"[LOGIN] JSON parseado: {data}")
        print(f"[LOGIN] ====================================")
        
        if not data:
            return jsonify({'error': 'JSON inválido ou ausente'}), 400

        usuario_id = (data.get('usuario_id') or '').strip()
        senha = data.get('senha') or ''

        if not usuario_id or not senha:
            return jsonify({'error': 'usuario_id e senha são obrigatórios'}), 400

        print(f"[LOGIN DEBUG] Tentando login (empresa) para usuario_id: {usuario_id}")

        # Buscar usuário de empresa na tabela UserCompany por user_id
        response = tabela_usuarioempresa.scan(
            FilterExpression=Attr('user_id').eq(usuario_id)
        )

        items = response.get('Items', [])
        print(f"[LOGIN DEBUG] Items UserCompany encontrados: {len(items)}")

        if not items:
            return jsonify({'error': 'Login ou senha incorretos'}), 401

        usuario = items[0]
        print(f"[LOGIN DEBUG] Usuário empresa encontrado. company_id={usuario.get('company_id')}")

        # Verificar senha (prioriza hash bcrypt)
        if usuario.get('senha_hash'):
            hash_verificado = verify_password(senha, usuario['senha_hash'])
            print(f"[LOGIN DEBUG] Hash verificado: {hash_verificado}")
            if not hash_verificado:
                return jsonify({'error': 'Login ou senha incorretos'}), 401
        elif usuario.get('senha'):
            if senha != usuario['senha']:
                return jsonify({'error': 'Login ou senha incorretos'}), 401
        else:
            return jsonify({'error': 'Login ou senha incorretos'}), 401

        print(f"[LOGIN DEBUG] Senha verificada com sucesso")

        secret_key = get_secret_key()
        token = jwt.encode({
            'usuario_id': usuario['user_id'],
            'empresa_nome': usuario.get('empresa_nome', ''),
            'company_id': usuario.get('company_id', ''),
            'tipo': 'empresa',
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        }, secret_key, algorithm="HS256")

        return jsonify({
            'token': token,
            'tipo': 'empresa',
            'usuario_id': usuario['user_id'],
            'empresa_nome': usuario.get('empresa_nome', ''),
            'company_id': usuario.get('company_id', ''),
        })

    except Exception as e:
        print(f"Erro no login: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Add CORS support to the cadastrar_usuario_empresa route
@routes.route('/cadastrar_usuario_empresa', methods=['POST', 'OPTIONS'])
def cadastrar_usuario_empresa():
    # OPTIONS é tratado automaticamente pelo Flask-CORS
    if request.method == 'OPTIONS':
        return '', 200
    
    from utils.auth import hash_password
    import re
    
    try:
        # ✅ CORREÇÃO: Usar request.get_json() em vez de request.json
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON inválido ou ausente'}), 400
            
        usuario_id = data.get('usuario_id')
        email = data.get('email')
        empresa_nome = data.get('empresa_nome')
        senha = data.get('senha')
        
        if not all([usuario_id, email, empresa_nome, senha]):
            return jsonify({'error': 'Campos obrigatórios ausentes'}), 400
        
        # Validação de formato de email
        email_regex = r'^[\w\.-]+@[\w\.-]+\.\w{2,}$'
        
        if not re.match(email_regex, email):
            return jsonify({'error': 'Email inválido'}), 400
        
        # Gerar empresa_id primeiro
        empresa_id = str(uuid.uuid4())
        senha_hash = hash_password(senha)
        
        # Debug: Log table info and AWS config
        import boto3
        from aws_utils import DYNAMODB_TABLE_USERS
        print(f"[DEBUG] Tentando scan na tabela: {tabela_usuarioempresa.name}")
        print(f"[DEBUG] DYNAMODB_TABLE_USERS env var: {DYNAMODB_TABLE_USERS}")
        print(f"[DEBUG] FilterExpression: Attr('email').eq('{email}')")
        
        # Check AWS credentials
        session = boto3.Session()
        credentials = session.get_credentials()
        print(f"[DEBUG] AWS Credentials available: {credentials is not None}")
        if credentials:
            print(f"[DEBUG] Access Key ID: {credentials.access_key[:10]}...")
        
        # Check region
        print(f"[DEBUG] DynamoDB Region: {tabela_usuarioempresa.meta.client.meta.region_name}")
        
        # Try to list tables
        try:
            dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
            tables = dynamodb_client.list_tables()
            print(f"[DEBUG] Available tables: {tables['TableNames']}")
        except Exception as e:
            print(f"[DEBUG] Error listing tables: {e}")
        
        # Verifica se email já existe (verificar unicidade)
        try:
            response = tabela_usuarioempresa.scan(
                FilterExpression=Attr('email').eq(email)
            )
            print(f"[DEBUG] Scan successful, items found: {len(response.get('Items', []))}")
            if response.get('Items'):
                return jsonify({'error': 'Email já cadastrado'}), 400
        except Exception as scan_error:
            print(f"[ERROR] Scan failed: {str(scan_error)}")
            print(f"[ERROR] Exception type: {type(scan_error).__name__}")
            import traceback
            print(f"[ERROR] Full traceback:\n{traceback.format_exc()}")
            raise
        
        # Inserir na tabela UserCompany (usa company_id + user_id como chaves)
        tabela_usuarioempresa.put_item(Item={
            'company_id': empresa_id,  # Partition key
            'user_id': usuario_id,     # Sort key
            'email': email,
            'empresa_nome': empresa_nome,
            'senha_hash': senha_hash,
            'data_criacao': datetime.now().isoformat()
        })
        
        return jsonify({'success': True, 'usuario_id': usuario_id, 'empresa_id': empresa_id}), 201
        
    except Exception as e:
        print(f"Erro ao cadastrar usuário empresa: {str(e)}")
        return jsonify({'error': str(e)}), 500

@routes.route('/funcionario/login', methods=['POST', 'OPTIONS'])
def login_funcionario():
    """
    Login para funcionários (para app mobile)
    Requer: funcionario_id (id do funcionário) e senha
    Retorna: token JWT com funcionario_id, nome, empresa_id
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    from utils.auth import verify_password, get_secret_key
    import datetime
    import jwt
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON inválido ou ausente'}), 400
        
        funcionario_id = (data.get('funcionario_id') or data.get('id') or '').strip()
        senha = data.get('senha') or ''
        
        if not funcionario_id or not senha:
            return jsonify({'error': 'ID do funcionário e senha são obrigatórios'}), 400
        
        # Buscar funcionário por ID usando scan (já que não temos company_id no login)
        print(f"[LOGIN FUNC] Buscando funcionário com ID: {funcionario_id}")
        
        try:
            # Usar scan porque no login mobile não temos o company_id
            response = tabela_funcionarios.scan(
                FilterExpression=Attr('id').eq(funcionario_id)
            )
            items = response.get('Items', [])
            funcionario = items[0] if items else None
        except Exception as e:
            print(f"[LOGIN FUNC] Erro ao buscar funcionário: {e}")
            funcionario = None
        
        if not funcionario:
            print(f"[LOGIN FUNC] Nenhum funcionário encontrado com ID: {funcionario_id}")
            return jsonify({'error': 'ID ou senha inválidos'}), 401
        
        print(f"[LOGIN FUNC] Funcionário encontrado: {funcionario.get('nome')}")
        
        # Verificar se funcionário está ativo (exclusão lógica)
        is_active = funcionario.get('is_active', funcionario.get('ativo', True))
        if not is_active:
            print(f"[LOGIN FUNC] Funcionário inativo (excluído em {funcionario.get('deleted_at')})")
            return jsonify({'error': 'Acesso negado. Funcionário inativo. Contate o RH.'}), 403
        
        # Verificar se tem senha cadastrada
        if not funcionario.get('senha_hash'):
            print(f"[LOGIN FUNC] Funcionário não tem senha cadastrada")
            return jsonify({'error': 'Funcionário não tem acesso configurado. Contate o RH.'}), 403
        
        # Verificar senha
        if not verify_password(senha, funcionario['senha_hash']):
            print(f"[LOGIN FUNC] Senha inválida")
            return jsonify({'error': 'ID ou senha inválidos'}), 401
        
        # Gerar token JWT
        secret_key = get_secret_key()
        token = jwt.encode({
            'funcionario_id': funcionario['id'],
            'nome': funcionario['nome'],
            'empresa_nome': funcionario.get('empresa_nome', ''),
            'company_id': funcionario['company_id'],
            'cargo': funcionario.get('cargo', ''),
            'tipo': 'funcionario',  # Identificar que é login de funcionário
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, secret_key, algorithm="HS256")
        
        print(f"[LOGIN FUNC] Login bem-sucedido para: {funcionario.get('nome')}")
        
        return jsonify({
            'token': token,
            'funcionario': {
                'id': funcionario['id'],
                'nome': funcionario['nome'],
                'cargo': funcionario.get('cargo', ''),
                'email': funcionario.get('email', ''),
                'horario_entrada': funcionario.get('horario_entrada', ''),
                'horario_saida': funcionario.get('horario_saida', '')
            }
        }), 200
        
    except Exception as e:
        print(f"[LOGIN FUNC] Erro no login: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes.route('/funcionario/registros', methods=['GET'])
@token_required
def meus_registros(payload):
    """
    Endpoint para funcionário ver seus próprios registros
    Requer token de funcionário
    """
    try:
        # Verificar se é um token de funcionário
        tipo = payload.get('tipo')
        if tipo != 'funcionario':
            return jsonify({'error': 'Acesso permitido apenas para funcionários'}), 403
        
        funcionario_id = payload.get('funcionario_id')
        empresa_id = payload.get('company_id')
        
        # Parâmetros de filtro
        data_inicio = request.args.get('inicio')
        data_fim = request.args.get('fim')
        
        print(f"[MEUS REGISTROS] Buscando registros de {funcionario_id}")
        
        # Buscar registros do funcionário usando a chave composta employee_id#date_time
        # Filtrar por company_id e employee_id# que começa com o funcionario_id
        filtro = Attr('company_id').eq(empresa_id) & Attr('employee_id#date_time').begins_with(funcionario_id)
        
        if data_inicio and data_fim:
            # Adicionar filtro de data se fornecido
            filtro = filtro & Attr('employee_id#date_time').between(
                f"{funcionario_id}#{data_inicio} 00:00:00",
                f"{funcionario_id}#{data_fim} 23:59:59"
            )
        
        response = tabela_registros.scan(FilterExpression=filtro)
        registros = response.get('Items', [])
        
        # Ordenar por data (mais recente primeiro)
        registros = sorted(registros, key=lambda x: x.get('employee_id#date_time', ''), reverse=True)
        
        print(f"[MEUS REGISTROS] Encontrados {len(registros)} registros")
        
        return jsonify({'registros': registros}), 200
        
    except Exception as e:
        print(f"[MEUS REGISTROS] Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes.route('/horarios', methods=['GET', 'OPTIONS'])
@token_required
def listar_horarios_preset(payload):
    """Lista horários pré-definidos da empresa"""
    try:
        empresa_id = payload.get('company_id')
        
        # Buscar configurações da empresa (tabela tem apenas company_id como chave)
        response = tabela_configuracoes.get_item(
            Key={'company_id': empresa_id}
        )
        
        config_item = response.get('Item', {})
        horarios = config_item.get('horarios_preset', [])
        
        # Garantir que é uma lista
        if not isinstance(horarios, list):
            horarios = []

        # Normalizar estrutura para compatibilidade
        horarios = [normalize_preset_schedule(h) for h in horarios]
        
        # Ordenar por nome
        horarios = sorted(horarios, key=lambda x: x.get('nome', ''))
        
        return jsonify(horarios)
    except Exception as e:
        print(f"Erro ao listar horários: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes.route('/horarios/funcionarios', methods=['GET'])
@token_required
def listar_horarios_por_funcionarios(payload):
    """
    Lista horários pré-definidos usados pelos funcionários da empresa
    Busca a coluna pred_hora de todos os funcionários
    """
    try:
        empresa_id = payload.get('company_id')
        
        # Fazer scan na tabela de Employees para encontrar todos os funcionários da empresa
        response = tabela_funcionarios.query(
            KeyConditionExpression=Key('company_id').eq(empresa_id)
        )
        
        funcionarios = response.get('Items', [])
        
        # Extrair todos os valores únicos de pred_hora
        presets_usados = set()
        for func in funcionarios:
            if 'pred_hora' in func and func['pred_hora']:
                presets_usados.add(func['pred_hora'])
        
        # Converter para lista ordenada
        presets_list = sorted(list(presets_usados))
        
        print(f"[DEBUG] Presets usados por funcionários: {presets_list}")
        
        return jsonify(presets_list)
    except Exception as e:
        print(f"Erro ao listar horários de funcionários: {str(e)}")
        return jsonify({'error': str(e)}), 500


@routes.route('/horarios/funcionarios/sem-preset', methods=['GET'])
@token_required
def listar_funcionarios_sem_preset(payload):
    """
    Lista funcionarios sem horario pre-definido (pred_hora vazio)
    """
    try:
        empresa_id = payload.get('company_id')

        response = tabela_funcionarios.query(
            KeyConditionExpression=Key('company_id').eq(empresa_id)
        )
        funcionarios = response.get('Items', [])

        sem_preset = []
        for func in funcionarios:
            pred_hora = (func.get('pred_hora') or '').strip()
            if pred_hora:
                continue
            sem_preset.append({
                'id': func.get('id'),
                'nome': func.get('nome'),
                'cargo': func.get('cargo', ''),
            })

        return jsonify(sem_preset)
    except Exception as e:
        print(f"Erro ao listar funcionarios sem preset: {str(e)}")
        return jsonify({'error': str(e)}), 500


@routes.route('/horarios/aplicar', methods=['POST'])
@token_required
def aplicar_horario_preset(payload):
    """
    Aplica um horario pre-definido a funcionarios selecionados
    Body: {"nome": "Horario X", "funcionarios": ["id1", "id2"]}
    """
    try:
        empresa_id = payload.get('company_id')
        data = request.get_json() or {}

        nome = (data.get('nome') or '').strip()
        funcionarios = data.get('funcionarios') or []

        if not nome or not isinstance(funcionarios, list) or not funcionarios:
            return jsonify({'error': 'nome e funcionarios sao obrigatorios'}), 400

        presets = _get_company_presets(empresa_id)
        preset = _find_preset_by_name(presets, nome)
        if not preset:
            return jsonify({'error': f'Horario "{nome}" nao encontrado'}), 404

        updated = 0
        for func_id in funcionarios:
            try:
                resp = tabela_funcionarios.get_item(Key={'company_id': empresa_id, 'id': func_id})
                func_item = resp.get('Item')
                if not func_item:
                    continue
                _apply_preset_to_employee(func_item, preset)
                tabela_funcionarios.put_item(Item=func_item)
                updated += 1
            except Exception as e:
                print(f"[HORARIOS] Falha ao aplicar preset em {func_id}: {e}")

        return jsonify({'success': True, 'updated': updated}), 200
    except Exception as e:
        print(f"Erro ao aplicar horario preset: {str(e)}")
        return jsonify({'error': str(e)}), 500

@routes.route('/horarios/<nome_horario>', methods=['GET'])
@token_required
def obter_horario_por_nome(nome_horario, payload):
    """
    Retorna os horários (entrada e saída) para um nome de preset
    Busca em ConfigCompany na coluna de presets
    """
    try:
        empresa_id = payload.get('company_id')
        
        # Buscar configuração de horários da empresa
        response = tabela_configuracoes.get_item(
            Key={'company_id': empresa_id}
        )
        
        config_item = response.get('Item', {})
        horarios = config_item.get('horarios_preset', [])
        
        # Procurar pelo nome
        horario_encontrado = next((h for h in horarios if h['nome'] == nome_horario), None)
        if horario_encontrado:
            horario_encontrado = normalize_preset_schedule(horario_encontrado)
        
        if horario_encontrado:
            return jsonify({
                'nome': horario_encontrado['nome'],
                'horario_entrada': horario_encontrado.get('horario_entrada'),
                'horario_saida': horario_encontrado.get('horario_saida'),
                'horarios': horario_encontrado.get('horarios')
            })
        else:
            return jsonify({'error': f'Horário "{nome_horario}" não encontrado'}), 404
    except Exception as e:
        print(f"Erro ao obter horário: {str(e)}")
        return jsonify({'error': str(e)}), 500

@routes.route('/horarios', methods=['POST'])
@token_required
def criar_horario_preset(payload):
    """
    Cria e salva um horário pré-definido para a empresa
    """
    try:
        empresa_id = payload.get('company_id')
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'JSON inválido ou ausente'}), 400
        
        nome = data.get('nome')  # ex: "Padrão"
        horario_entrada = data.get('horario_entrada')  # ex: "08:00"
        horario_saida = data.get('horario_saida')  # ex: "17:00"
        horarios_payload = data.get('horarios')
        
        if not nome:
            return jsonify({'error': 'nome é obrigatório'}), 400

        # Validar formato HH:MM
        import re
        time_pattern = r'^([01]\d|2[0-3]):([0-5]\d)$'

        if isinstance(horarios_payload, dict) and horarios_payload:
            for day_name, day_data in horarios_payload.items():
                if not isinstance(day_data, dict):
                    return jsonify({'error': f'Estrutura inválida para {day_name}'}), 400
                ativo = day_data.get('ativo', True)
                entrada = day_data.get('entrada')
                saida = day_data.get('saida')
                if ativo:
                    if not entrada or not saida:
                        return jsonify({'error': f'Entrada e saída obrigatórias para {day_name}'}), 400
                    if not re.match(time_pattern, entrada) or not re.match(time_pattern, saida):
                        return jsonify({'error': f'Formato inválido em {day_name}. Use HH:MM'}), 400
                else:
                    if entrada or saida:
                        return jsonify({'error': f'{day_name} está inativo e não deve ter horário'}), 400
        elif horario_entrada and horario_saida:
            if not re.match(time_pattern, horario_entrada) or not re.match(time_pattern, horario_saida):
                return jsonify({'error': 'Formato de horário inválido. Use HH:MM'}), 400
            horarios_payload = build_pt_schedule_from_legacy(horario_entrada, horario_saida)
        else:
            return jsonify({'error': 'horarios ou horario_entrada/horario_saida são obrigatórios'}), 400
        
        # Buscar configuração existente ou criar nova
        response = tabela_configuracoes.get_item(
            Key={'company_id': empresa_id}
        )
        
        config_item = response.get('Item', {})
        horarios = config_item.get('horarios_preset', [])
        
        # Garantir que é uma lista
        if not isinstance(horarios, list):
            horarios = []
        
        # Verificar se horário com esse nome já existe
        horario_existente = next((h for h in horarios if h['nome'] == nome), None)
        
        entrada_legacy, saida_legacy = get_first_active_times(horarios_payload)

        if horario_existente:
            # Atualizar horário existente
            horario_existente['horarios'] = horarios_payload
            horario_existente['horario_entrada'] = entrada_legacy
            horario_existente['horario_saida'] = saida_legacy
        else:
            # Adicionar novo horário
            horario_id = str(uuid.uuid4())
            horarios.append({
                'id': horario_id,
                'nome': nome,
                'horarios': horarios_payload,
                'horario_entrada': entrada_legacy,
                'horario_saida': saida_legacy,
                'data_criacao': datetime.now().isoformat()
            })
        
        # Atualizar apenas o campo horarios_preset no item existente
        tabela_configuracoes.update_item(
            Key={'company_id': empresa_id},
            UpdateExpression='SET horarios_preset = :hp, updated_at = :ua',
            ExpressionAttributeValues={
                ':hp': horarios,
                ':ua': datetime.now().isoformat()
            }
        )
        
        print(f"[HORARIOS] Horário '{nome}' salvo com sucesso para empresa {empresa_id}")
        
        return jsonify({
            'success': True,
            'nome': nome,
            'horario_entrada': entrada_legacy,
            'horario_saida': saida_legacy,
            'horarios': horarios_payload
        }), 201
        
    except Exception as e:
        print(f"Erro ao criar horário preset: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes.route('/horarios/<nome_horario>', methods=['DELETE', 'OPTIONS'])
@token_required
def excluir_horario_preset(payload, nome_horario):
    if request.method == 'OPTIONS':
        return '', 200
    """
    Exclui um horário pré-definido da empresa
    """
    try:
        from urllib.parse import unquote
        nome_horario = unquote(nome_horario or '')
        empresa_id = payload.get('company_id')
        
        # Buscar configuração existente
        response = tabela_configuracoes.get_item(
            Key={'company_id': empresa_id}
        )
        
        config_item = response.get('Item', {})
        horarios = config_item.get('horarios_preset', [])
        
        # Garantir que é uma lista
        if not isinstance(horarios, list):
            horarios = []
        
        # Filtrar para remover o horário
        horarios_filtrados = []
        for h in horarios:
            if not isinstance(h, dict):
                horarios_filtrados.append(h)
                continue
            if h.get('nome') != nome_horario:
                horarios_filtrados.append(h)
        
        if len(horarios_filtrados) == len(horarios):
            return jsonify({'error': f'Horário "{nome_horario}" não encontrado'}), 404
        
        # Atualizar apenas o campo horarios_preset
        tabela_configuracoes.update_item(
            Key={'company_id': empresa_id},
            UpdateExpression='SET horarios_preset = :hp, updated_at = :ua',
            ExpressionAttributeValues={
                ':hp': horarios_filtrados,
                ':ua': datetime.now().isoformat()
            }
        )
        
        print(f"[HORARIOS] Horário '{nome_horario}' excluído com sucesso para empresa {empresa_id}")
        
        return jsonify({
            'success': True,
            'message': f'Horário "{nome_horario}" excluído com sucesso'
        }), 200
        
    except Exception as e:
        print(f"Erro ao excluir horário preset: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ========== CONFIGURAÇÕES DA EMPRESA ==========
@routes.route('/configuracoes', methods=['GET', 'PUT', 'OPTIONS'])
def configuracoes_empresa():
    """Gerencia configurações da empresa (GET/PUT)"""
    # Tratar OPTIONS primeiro (CORS preflight)
    if request.method == 'OPTIONS':
        return '', 200
    
    # Verificar token para GET e PUT
    token = None
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    
    if not token:
        return jsonify({'error': 'Token ausente'}), 401
    
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Token inválido'}), 401
    
    empresa_id = payload.get('company_id')
    print(f"[CONFIGURACOES] Company ID: {empresa_id}")
    
    if not empresa_id:
        return jsonify({'error': 'Company ID não encontrado no token'}), 401
    
    # GET - Obter configurações
    if request.method == 'GET':
        try:
            # Buscar configurações
            print(f"[CONFIGURACOES] Buscando configurações para empresa: {empresa_id}")
            response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
            
            if 'Item' in response:
                config_data = response['Item']
                # Se tem configurações salvas, não é primeiro acesso
                # Verificar se tem o campo first_configuration_completed
                is_first_access = not config_data.get('first_configuration_completed', False)
                config_data['is_first_access'] = is_first_access
                print(f"[CONFIGURACOES] Configurações encontradas. first_configuration_completed: {config_data.get('first_configuration_completed')}, is_first_access: {is_first_access}")
                return jsonify(config_data), 200
            else:
                # Retornar configurações padrão com flag de primeiro acesso
                configuracoes_padrao = {
                    'company_id': empresa_id,
                    'tolerancia_atraso': 5,  # 5 minutos
                    'hora_extra_entrada_antecipada': False,
                    'arredondamento_horas_extras': '5',  # 5, 10, 15 ou 'exato'
                    'intervalo_automatico': False,
                    'duracao_intervalo': 60,  # minutos
                    'compensar_saldo_horas': False,
                    'is_first_access': True  # Indica que é primeiro acesso
                }
                return jsonify(configuracoes_padrao), 200
                
        except Exception as e:
            print(f"Erro ao obter configurações: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    # PUT - Atualizar configurações
    elif request.method == 'PUT':
        try:
            data = request.get_json()
            
            tolerancia_atraso = data.get('tolerancia_atraso', 5)
            hora_extra_entrada_antecipada = data.get('hora_extra_entrada_antecipada', False)
            arredondamento_horas_extras = data.get('arredondamento_horas_extras', '5')
            intervalo_automatico = data.get('intervalo_automatico', False)
            duracao_intervalo = data.get('duracao_intervalo', 60)
            compensar_saldo_horas = data.get('compensar_saldo_horas', False)
            
            # Novos campos de geolocalização
            latitude_empresa = data.get('latitude_empresa')
            longitude_empresa = data.get('longitude_empresa')
            raio_permitido = data.get('raio_permitido', 100)  # metros
            exigir_localizacao = data.get('exigir_localizacao', False)
            
            # Validações
            if not isinstance(tolerancia_atraso, int) or tolerancia_atraso < 0:
                return jsonify({'error': 'Tolerância de atraso deve ser um número inteiro positivo'}), 400
            
            if arredondamento_horas_extras not in ['5', '10', '15', 'exato']:
                return jsonify({'error': 'Arredondamento deve ser 5, 10, 15 ou exato'}), 400
            
            if not isinstance(duracao_intervalo, int) or duracao_intervalo < 0:
                return jsonify({'error': 'Duração do intervalo deve ser um número inteiro positivo'}), 400
            
            # Validar geolocalização
            if exigir_localizacao and (latitude_empresa is None or longitude_empresa is None):
                return jsonify({'error': 'Latitude e longitude são obrigatórias quando geolocalização está ativa'}), 400
            
            if raio_permitido and (not isinstance(raio_permitido, int) or raio_permitido < 0):
                return jsonify({'error': 'Raio permitido deve ser um número inteiro positivo'}), 400
            
            # Buscar configuração existente para preservar campos não enviados
            # (ex: horarios_preset, latitude, longitude, etc.)
            existing_response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
            config_item = existing_response.get('Item', {'company_id': empresa_id})
            
            # Atualizar apenas os campos enviados pelo frontend
            config_item['tolerancia_atraso'] = tolerancia_atraso
            config_item['hora_extra_entrada_antecipada'] = hora_extra_entrada_antecipada
            config_item['arredondamento_horas_extras'] = arredondamento_horas_extras
            config_item['intervalo_automatico'] = intervalo_automatico
            config_item['duracao_intervalo'] = duracao_intervalo
            config_item['compensar_saldo_horas'] = compensar_saldo_horas
            config_item['exigir_localizacao'] = exigir_localizacao
            config_item['raio_permitido'] = raio_permitido
            config_item['data_atualizacao'] = datetime.now().isoformat()
            config_item['first_configuration_completed'] = True
            
            # Adicionar coordenadas se fornecidas
            if latitude_empresa is not None:
                config_item['latitude_empresa'] = Decimal(str(float(latitude_empresa)))
            if longitude_empresa is not None:
                config_item['longitude_empresa'] = Decimal(str(float(longitude_empresa)))
            
            # Salvar configurações (preserva campos existentes como horarios_preset)
            tabela_configuracoes.put_item(Item=config_item)
            
            response_data = {
                'success': True,
                'tolerancia_atraso': tolerancia_atraso,
                'hora_extra_entrada_antecipada': hora_extra_entrada_antecipada,
                'arredondamento_horas_extras': arredondamento_horas_extras,
                'intervalo_automatico': intervalo_automatico,
                'duracao_intervalo': duracao_intervalo,
                'compensar_saldo_horas': compensar_saldo_horas,
                'exigir_localizacao': exigir_localizacao,
                'raio_permitido': raio_permitido
            }
            
            if latitude_empresa is not None:
                response_data['latitude_empresa'] = latitude_empresa
            if longitude_empresa is not None:
                response_data['longitude_empresa'] = longitude_empresa
            
            return jsonify(response_data), 200
            
        except Exception as e:
            print(f"Erro ao atualizar configurações: {str(e)}")
            return jsonify({'error': str(e)}), 500

@routes.route('/company/update-location', methods=['POST', 'OPTIONS'])
@token_required
def update_company_location(payload):
    """
    Atualiza a localização da empresa (latitude, longitude, raio permitido).
    Usado pelo painel web para definir onde a empresa está localizada.
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON inválido ou ausente'}), 400
        
        company_id = payload.get('company_id')
        
        # Validar campos obrigatórios
        company_lat = data.get('company_lat')
        company_lng = data.get('company_lng')
        raio_permitido = data.get('raio_permitido', 100)
        exigir_localizacao = data.get('exigir_localizacao', True)
        
        if company_lat is None or company_lng is None:
            return jsonify({'error': 'Latitude e longitude são obrigatórias'}), 400
        
        # Validar tipos e ranges
        try:
            company_lat = float(company_lat)
            company_lng = float(company_lng)
            raio_permitido = int(raio_permitido)
            exigir_localizacao = bool(exigir_localizacao)
        except (ValueError, TypeError):
            return jsonify({'error': 'Valores inválidos para lat/lng/raio'}), 400
        
        # Validar ranges geográficos
        if not (-90 <= company_lat <= 90):
            return jsonify({'error': 'Latitude deve estar entre -90 e 90'}), 400
        if not (-180 <= company_lng <= 180):
            return jsonify({'error': 'Longitude deve estar entre -180 e 180'}), 400
        if raio_permitido < 10 or raio_permitido > 5000:
            return jsonify({'error': 'Raio deve estar entre 10m e 5000m'}), 400
        
        print(f"[UPDATE LOCATION] Atualizando localização para company_id: {company_id}")
        print(f"[UPDATE LOCATION] Lat: {company_lat}, Lng: {company_lng}, Raio: {raio_permitido}m")
        
        # Buscar configuração existente
        response = tabela_configuracoes.get_item(
            Key={'company_id': company_id}
        )
        
        config_item = response.get('Item', {})
        if not config_item:
            # Criar nova configuração
            config_item = {
                'company_id': company_id,
                'tolerancia_atraso': 5,
                'hora_extra_entrada_antecipada': False,
                'arredondamento_horas_extras': '5',
                'intervalo_automatico': False,
                'duracao_intervalo': 60,
                'compensar_saldo_horas': False
            }
        
        # Atualizar campos de localização (converter para Decimal para DynamoDB)
        # Salvamos tanto nomes legados quanto os novos nomes para compatibilidade
        config_item['company_lat'] = Decimal(str(company_lat))
        config_item['company_lng'] = Decimal(str(company_lng))
        config_item['latitude'] = Decimal(str(company_lat))
        config_item['longitude'] = Decimal(str(company_lng))
        # Raio em metros - manter nome legado e novo nome solicitado
        config_item['raio_permitido'] = raio_permitido
        config_item['raio_permitido_metros'] = raio_permitido
        config_item['exigir_localizacao'] = exigir_localizacao
        config_item['setup_completed'] = True
        
        # Salvar no DynamoDB
        tabela_configuracoes.put_item(Item=config_item)
        
        print(f"[UPDATE LOCATION] Localização salva com sucesso")
        
        return jsonify({
            'success': True,
            'company_lat': float(company_lat),
            'company_lng': float(company_lng),
            'raio_permitido': raio_permitido,
            'exigir_localizacao': exigir_localizacao,
            'message': 'Localização atualizada com sucesso'
        }), 200
        
    except Exception as e:
        print(f"[UPDATE LOCATION] Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes.route('/registrar_ponto_localizacao', methods=['POST', 'OPTIONS'])
@token_required
def registrar_ponto_localizacao(payload):
    """
    Registra ponto do funcionário usando validação por geolocalização (sem reconhecimento facial).
    Valida se o funcionário está dentro do raio permitido da empresa.
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    from geolocation_utils import validar_localizacao, formatar_distancia
    import uuid
    from datetime import datetime
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON inválido ou ausente'}), 400
        
        # Dados do funcionário (do token)
        funcionario_id = payload.get('funcionario_id')
        company_id = payload.get('company_id')
        funcionario_nome = payload.get('nome', '')
        
        if not funcionario_id or not company_id:
            return jsonify({'error': 'Token inválido'}), 401
        
        # Dados da localização do usuário
        user_lat = data.get('user_lat') or data.get('latitude')
        user_lng = data.get('user_lng') or data.get('longitude')
        tipo_solicitado = data.get('tipo', 'entrada')  # tipo enviado pelo client (pode ser sobrescrito)
        provider = data.get('provider') or data.get('source') or data.get('is_gps')
        
        if user_lat is None or user_lng is None:
            return jsonify({'error': 'Localização do usuário é obrigatória'}), 400
        
        try:
            user_lat = float(user_lat)
            user_lng = float(user_lng)
        except (ValueError, TypeError):
            return jsonify({'error': 'Coordenadas inválidas'}), 400

        # Security: only allow GPS-sourced coordinates for validation
        # Expect mobile clients to send provider='gps' or is_gps=true
        provider_flag = False
        if isinstance(provider, bool):
            provider_flag = provider
        elif isinstance(provider, (int, float)):
            provider_flag = bool(provider)
        elif isinstance(provider, str):
            provider_flag = provider.lower() in ['gps', 'location', 'gpsprovider', 'true', '1']

        if not provider_flag:
            # Reject requests that don't explicitly declare GPS source
            return jsonify({
                'success': False,
                'error': 'Localização sem fonte GPS não pode ser usada para validar ponto. Use o app móvel (GPS).'
            }), 400
        
        print(f"[REGISTRO LOCATION] Funcionário: {funcionario_nome} ({funcionario_id})")
        print(f"[REGISTRO LOCATION] Localização: {user_lat}, {user_lng}")
        
        # Buscar configurações da empresa
        config_response = tabela_configuracoes.get_item(
            Key={'company_id': company_id}
        )
        
        config = config_response.get('Item', {})
        
        # Verificar se a empresa tem localização configurada
        company_lat = config.get('company_lat')
        company_lng = config.get('company_lng')
        exigir_localizacao = config.get('exigir_localizacao', False)
        raio_permitido = config.get('raio_permitido', 100)
        
        # Converter Decimal para float se necessário
        if company_lat:
            company_lat = float(company_lat)
        if company_lng:
            company_lng = float(company_lng)
        if raio_permitido:
            raio_permitido = int(raio_permitido)
        
        print(f"[REGISTRO LOCATION] Config: company_lat={company_lat}, company_lng={company_lng}")
        print(f"[REGISTRO LOCATION] Config: exigir_localizacao={exigir_localizacao}, raio={raio_permitido}m")
        
        distance = None
        location_valid = True
        
        if exigir_localizacao:
            if not company_lat or not company_lng:
                return jsonify({
                    'success': False,
                    'error': 'Localização da empresa não configurada. Entre em contato com o RH.'
                }), 400
            
            # Validar localização
            location_valid, distance = validar_localizacao(
                user_lat, user_lng,
                company_lat, company_lng,
                raio_permitido
            )
            
            print(f"[REGISTRO LOCATION] Distância: {distance}m, Raio permitido: {raio_permitido}m")
            print(f"[REGISTRO LOCATION] Dentro do raio: {location_valid}")
            
            if not location_valid:
                return jsonify({
                    'success': False,
                    'error': f'Você está fora da área permitida. Distância: {formatar_distancia(distance)}',
                    'distance': distance,
                    'raio_permitido': raio_permitido
                }), 403
        
        # Buscar dados do funcionário usando chave composta
        try:
            func_response = tabela_funcionarios.get_item(
                Key={
                    'company_id': company_id,
                    'id': funcionario_id
                }
            )
            funcionario = func_response.get('Item')
        except Exception as e:
            print(f"[REGISTRO LOCATION] Erro ao buscar funcionário: {e}")
            # Fallback: scan
            func_response = tabela_funcionarios.scan(
                FilterExpression=Attr('id').eq(funcionario_id) & Attr('company_id').eq(company_id)
            )
            items = func_response.get('Items', [])
            funcionario = items[0] if items else None
        
        if not funcionario:
            return jsonify({'error': 'Funcionário não encontrado'}), 404
        
        # Registrar ponto
        data_hora_atual = data.get('data_hora')
        if not data_hora_atual:
            data_hora_atual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        hoje_str = data_hora_atual[:10]  # YYYY-MM-DD
        
        # Determinar tipo correto baseado nos registros do dia
        # Simples toggle: entrada → saída → entrada → saída ...
        try:
            response_registros_loc = tabela_registros.scan(
                FilterExpression=Attr('company_id').eq(company_id) & Attr('employee_id#date_time').begins_with(f"{funcionario_id}#{hoje_str}")
            )
            registros_dia_loc = sorted(response_registros_loc.get('Items', []), key=lambda x: x.get('employee_id#date_time', ''))
            # Filtrar registros INVALIDADOS/AJUSTADOS
            registros_dia_loc = [r for r in registros_dia_loc if (r.get('status') or 'ATIVO').upper() not in ('INVALIDADO', 'AJUSTADO')]
            
            if not registros_dia_loc:
                tipo = 'entrada'
            else:
                ultimo_tipo_loc = registros_dia_loc[-1].get('type', registros_dia_loc[-1].get('tipo', 'saida'))
                tipo = 'entrada' if ultimo_tipo_loc in ('saida', 'saída') else 'saida'
        except Exception as e:
            print(f"[REGISTRO LOCATION] Erro ao determinar tipo: {e}")
            tipo = tipo_solicitado  # fallback para o tipo enviado pelo client

        # Calcular horário de cálculo (arredondado se dentro da tolerância para entradas)
        data_hora_calculo = data_hora_atual  # Por padrão igual ao real
        
        if tipo == 'entrada':
            tolerancia_atraso = int(config.get('tolerancia_atraso', 5))
            try:
                data_str = data_hora_atual.split(' ')[0]
                target_date = datetime.strptime(data_str, '%Y-%m-%d').date()
            except Exception:
                target_date = None
            if target_date:
                horario_entrada_esperado, _ = get_schedule_for_date(funcionario, target_date)
            else:
                horario_entrada_esperado = funcionario.get('horario_entrada')
            
            if horario_entrada_esperado:
                try:
                    data_str = data_hora_atual.split(' ')[0]  # YYYY-MM-DD
                    
                    # Parse horário atual
                    try:
                        entrada_real = datetime.strptime(data_hora_atual, '%Y-%m-%d %H:%M:%S')
                    except:
                        entrada_real = datetime.strptime(data_hora_atual, '%Y-%m-%d %H:%M')
                    
                    # Parse horário esperado
                    try:
                        entrada_esperada = datetime.strptime(f"{data_str} {horario_entrada_esperado}", '%Y-%m-%d %H:%M')
                    except:
                        entrada_esperada = datetime.strptime(f"{data_str} {horario_entrada_esperado}", '%Y-%m-%d %H:%M:%S')
                    
                    diff_min = int((entrada_real - entrada_esperada).total_seconds() // 60)
                    
                    if diff_min <= tolerancia_atraso:
                        # Dentro da tolerância: arredondar horário de CÁLCULO para o esperado
                        data_hora_calculo = f"{data_str} {horario_entrada_esperado}"
                        print(f"[REGISTRO LOCATION] Entrada dentro da tolerância ({diff_min}min). Arredondando cálculo para {horario_entrada_esperado}")
                except Exception as e:
                    print(f"[REGISTRO LOCATION] Aviso ao calcular arredondamento: {e}")

        # Criar registro com schema correto da tabela TimeRecords
        # HASH: company_id, RANGE: employee_id#date_time
        # Optionally store accuracy and provider for auditing
        user_accuracy = data.get('accuracy') or data.get('accuracy_meters') or data.get('user_accuracy')
        registro_item = {
            'company_id': company_id,  # HASH key
            'employee_id#date_time': f"{funcionario_id}#{data_hora_atual}",  # RANGE key
            'data_hora': data_hora_atual,  # Horário REAL para exibição
            'data_hora_calculo': data_hora_calculo,  # Horário arredondado para cálculos
            'employee_id': funcionario_id,
            'type': tipo,  # Padronizado para 'type'
            'funcionario_nome': funcionario.get('nome', ''),
            'empresa_nome': funcionario.get('empresa_nome', ''),
            'method': 'LOCATION',  # Método de registro
            'user_lat': Decimal(str(user_lat)),
            'user_lng': Decimal(str(user_lng)),
            'distance_from_company': Decimal(str(distance)) if distance is not None else Decimal('0'),
            'dentro_do_raio': location_valid,
            'provider': 'gps',
        }

        # Save accuracy if provided
        if user_accuracy is not None:
            try:
                registro_item['user_accuracy'] = Decimal(str(user_accuracy))
            except Exception:
                registro_item['user_accuracy'] = user_accuracy
        
        # Salvar registro
        tabela_registros.put_item(Item=registro_item)
        
        print(f"[REGISTRO LOCATION] Ponto registrado com sucesso: {funcionario_id}#{data_hora_atual}")
        
        # Mapeamento de tipo para label amigável
        tipo_labels = {
            'entrada': 'Entrada',
            'saida': 'Saída',
            'saída': 'Saída',
        }
        tipo_label = tipo_labels.get(tipo, tipo)
        
        response_data = {
            'success': True,
            'message': f'Ponto de {tipo_label} registrado com sucesso!',
            'data_hora': data_hora_atual,
            'tipo': tipo,
            'tipo_label': tipo_label,
            'method': 'LOCATION',
            'location_valid': location_valid
        }
        
        if distance is not None:
            response_data['distance'] = formatar_distancia(distance)
            response_data['distance_meters'] = distance
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"[REGISTRO LOCATION] Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes.route('/teste', methods=['GET', 'OPTIONS'])
def teste():
    return jsonify({'mensagem': 'Rota de teste funcionando!'}), 200