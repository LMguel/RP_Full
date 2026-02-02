from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
import uuid
import tempfile
import os
import boto3
from aws_utils import (
    tabela_funcionarios, tabela_registros, enviar_s3, reconhecer_funcionario, rekognition, BUCKET, COLLECTION, REGIAO, tabela_usuarioempresa, tabela_configuracoes
)
from functools import wraps
from auth import verify_token
from werkzeug.security import check_password_hash
import jwt
from flask import current_app
from boto3.dynamodb.conditions import Attr, Key
from overtime_calculator import calculate_overtime, format_minutes_to_time
from geolocation_utils import validar_localizacao, formatar_distancia
import unicodedata
import re
from logger import setup_logger

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

@routes.route('/registros/<registro_id>', methods=['DELETE', 'OPTIONS'])
def deletar_registro(registro_id):
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
            # Verificar se o registro existe antes de deletar
            verify_response = tabela_registros.get_item(Key={
                'company_id': company_id,
                'employee_id#date_time': composite_key
            })
            if 'Item' not in verify_response:
                print(f"[DELETE REGISTRO] ❌ Registro não encontrado no DynamoDB")
                return jsonify({'error': 'Registro não encontrado'}), 404
            # Deletar o registro
            tabela_registros.delete_item(Key={
                'company_id': company_id,
                'employee_id#date_time': composite_key
            })
            # Verificar se foi realmente deletado
            verify_after = tabela_registros.get_item(Key={
                'company_id': company_id,
                'employee_id#date_time': composite_key
            })
            if 'Item' in verify_after:
                print(f"[DELETE REGISTRO] ⚠️ AVISO: Registro ainda existe após delete_item!")
            else:
                print(f"[DELETE REGISTRO] ✅ Confirmado: Registro deletado com sucesso!")
            return jsonify({'success': True}), 200
        except Exception:
            import traceback
            traceback.print_exc()
            return jsonify({'error': 'Erro ao deletar registro'}), 500
            # Verificar se foi realmente deletado
            verify_after = tabela_registros.get_item(Key={
                'company_id': company_id,
                'employee_id#date_time': composite_key
            })

            if 'Item' in verify_after:
                print(f"[DELETE REGISTRO] ⚠️ AVISO: Registro ainda existe após delete_item!")
            else:
                print(f"[DELETE REGISTRO] ✅ Confirmado: Registro deletado com sucesso!")
            return jsonify({'success': True}), 200

        # Se ExternalImageId foi indexado com prefixo company_id_employee_id, explodimos
        # para obter company_id e funcionario_id (evita scans globais).
        funcionario_id = reconhecimento_result
        empresa_id_from_face = None
        # Tentar split por _ mas só se tiver formato UUID_nome_hash
        if isinstance(reconhecimento_result, str) and '_' in reconhecimento_result:
            # ExternalImageId: empresa_id_funcionario_id
            # Formato: uuid_nome_hash (ex: 82094db4-8df5-44bb-aa3e-b75392181a53_miguel_785262)
            parts = reconhecimento_result.split('_', 1)
            if len(parts) == 2 and '-' in parts[0]:  # Verifica se primeira parte é UUID
                empresa_id_from_face, funcionario_id = parts

        funcionario = None
        # Tabela Employees usa composite key (company_id + id)
        if empresa_id_from_face:
            # Temos company_id do ExternalImageId
            try:
                response = tabela_funcionarios.get_item(Key={
                    'company_id': empresa_id_from_face,
                    'id': funcionario_id
                })
                funcionario = response.get('Item')
            except Exception as e:
                print(f"[REGISTRO] Erro ao buscar com composite key: {e}")
        
        if not funcionario:
            # Fallback: scan pelo id (para retrocompatibilidade)
            print(f"[REGISTRO] Fazendo scan para buscar funcionário id={funcionario_id}")
            response = tabela_funcionarios.scan(FilterExpression=Attr('id').eq(funcionario_id))
            items = response.get('Items', [])
            if not items:
                return jsonify({
                    'success': False,
                    'message': 'Funcionário não encontrado'
                }), 404
            funcionario = items[0]
            print(f"[REGISTRO] Funcionário encontrado via scan: {funcionario['nome']}")

        funcionario_nome = funcionario['nome']
        company_id = funcionario.get('company_id')
        funcionario_home_office = funcionario.get('home_office', False)
        
        # Verificar se funcionário está ativo (exclusão lógica)
        is_active = funcionario.get('is_active', funcionario.get('ativo', True))
        if not is_active:
            print(f"[REGISTRO] ❌ Funcionário inativo tentou registrar ponto: {funcionario_nome}")
            return jsonify({
                'success': False,
                'message': 'Funcionário inativo. Contate o RH.',
                'inactive': True
            }), 403
        
        # Validar geolocalização (se não for home office e se tiver coordenadas enviadas)
        if not preview_mode and not funcionario_home_office:
            latitude_usuario = request.form.get('latitude')
            longitude_usuario = request.form.get('longitude')
            
            if latitude_usuario and longitude_usuario:
                try:
                    # Buscar configurações da empresa
                    config_response = tabela_configuracoes.get_item(Key={'company_id': company_id})
                    configuracoes = config_response.get('Item', {})
                    
                    exigir_localizacao = configuracoes.get('exigir_localizacao', False)
                    
                    if exigir_localizacao:
                        latitude_empresa = configuracoes.get('latitude_empresa')
                        longitude_empresa = configuracoes.get('longitude_empresa')
                        raio_permitido = configuracoes.get('raio_permitido', 100)
                        
                        if latitude_empresa and longitude_empresa:
                            dentro_do_raio, distancia = validar_localizacao(
                                float(latitude_usuario),
                                float(longitude_usuario),
                                float(latitude_empresa),
                                float(longitude_empresa),
                                raio_permitido
                            )
                            
                            print(f"[REGISTRO] Validação geolocalização: distância={formatar_distancia(distancia)}, permitido={raio_permitido}m")
                            
                            if not dentro_do_raio:
                                return jsonify({
                                    'success': False,
                                    'message': f'Você está muito longe da empresa. Distância: {formatar_distancia(distancia)}',
                                    'fora_do_raio': True,
                                    'distancia': distancia
                                }), 403
                        else:
                            print("[REGISTRO] ⚠️ Geolocalização exigida mas coordenadas da empresa não configuradas")
                except Exception as e:
                    print(f"[REGISTRO] Erro ao validar geolocalização: {str(e)}")
                    # Não bloquear o registro se houver erro na validação
            elif not preview_mode:
                # Verificar se empresa exige geolocalização
                try:
                    config_response = tabela_configuracoes.get_item(Key={'company_id': company_id})
                    configuracoes = config_response.get('Item', {})
                    exigir_localizacao = configuracoes.get('exigir_localizacao', False)
                    
                    if exigir_localizacao:
                        return jsonify({
                            'success': False,
                            'message': 'Localização é obrigatória para registrar ponto',
                            'localizacao_obrigatoria': True
                        }), 400
                except Exception as e:
                    print(f"[REGISTRO] Erro ao verificar configurações: {str(e)}")
        
        agora = datetime.now(ZoneInfo('America/Sao_Paulo'))
        hoje = agora.strftime('%Y-%m-%d')
        data_hora_str = agora.strftime('%Y-%m-%d %H:%M:%S')
        
        # Buscar registros do dia usando composite key da tabela TimeRecords
        # HASH: company_id, RANGE: employee_id#date_time
        print(f"[REGISTRO] Buscando registros do dia para company_id={company_id}, funcionario_id={funcionario_id}")
        response_registros = tabela_registros.scan(
            FilterExpression=Attr('company_id').eq(company_id) & Attr('employee_id#date_time').begins_with(f"{funcionario_id}#{hoje}")
        )
        registros_do_dia = sorted(response_registros['Items'], key=lambda x: x.get('employee_id#date_time', ''))

        # Verificar último registro para determinar tipo (entrada/saída)
        ultimo_tipo = registros_do_dia[-1].get('type', registros_do_dia[-1].get('tipo', 'saida')) if registros_do_dia else 'saida'
        tipo = 'entrada' if not registros_do_dia or ultimo_tipo in ('saida', 'saída') else 'saida'
        
        # Se for modo preview, retornar apenas informações sem salvar
        if preview_mode:
            print(f"[REGISTRO] 👁️ Modo preview - retornando reconhecimento sem salvar")
            return jsonify({
                'success': True,
                'funcionario_nome': funcionario_nome,
                'nome': funcionario_nome,
                'tipo_registro': tipo,
                'tipo': tipo,
                'confidence': 0.92,  # Simular confiança alta (em produção, pegar do Rekognition)
                'livenessOk': True,  # Simular liveness OK
                'message': f'Funcionário reconhecido: {funcionario_nome}'
            }), 200

        # Criar registro com schema correto da tabela TimeRecords
        # HASH: company_id, RANGE: employee_id#date_time
        registro = {
            'company_id': company_id,  # HASH key
            'employee_id#date_time': f"{funcionario_id}#{data_hora_str}",  # RANGE key
            'type': tipo,  # Usar 'type' padronizado
            'method': 'FACIAL',  # Reconhecimento facial (legado)
            'funcionario_nome': funcionario_nome,
            'empresa_nome': funcionario.get('empresa_nome', ''),
        }
        
    # Se for saída, calcular horas extras
        if tipo == 'saída' and registros_do_dia:
            try:
                # Buscar configurações da empresa
                empresa_id = funcionario.get('company_id')
                # Tabela ConfiguracoesEmpresa usa 'empresa_id' como chave
                config_response = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
                
                configuracoes = config_response.get('Item', {
                    'tolerancia_atraso': 5,
                    'hora_extra_entrada_antecipada': False,
                    'arredondamento_horas_extras': '5',
                    'intervalo_automatico': False,
                    'duracao_intervalo': 60
                })
                
                # Pegar horários esperados do funcionário
                horario_entrada_esperado = funcionario.get('horario_entrada')
                horario_saida_esperado = funcionario.get('horario_saida')
                
                # Pegar horários reais (entrada do dia + saída agora)
                # employee_id#date_time formato: miguel_123#2025-11-10 08:30:00
                primeiro_registro_key = registros_do_dia[0].get('employee_id#date_time', '')
                horario_entrada_real = primeiro_registro_key.split('#')[1].split(' ')[1][:5] if '#' in primeiro_registro_key else '00:00'
                horario_saida_real = agora.strftime('%H:%M')
                
                # Calcular se tem horários cadastrados
                if horario_entrada_esperado and horario_saida_esperado:
                    intervalo_to_use = funcionario.get('intervalo_emp', configuracoes.get('duracao_intervalo', 60))
                    calculo = calculate_overtime(
                        horario_entrada_esperado,
                        horario_saida_esperado,
                        horario_entrada_real,
                        horario_saida_real,
                        configuracoes,
                        configuracoes.get('intervalo_automatico', False),
                        intervalo_to_use
                    )
                    
                    # Adicionar informações ao registro (apenas horas extras e trabalhadas)
                    registro['horas_extras_minutos'] = calculo['horas_extras_minutos']
                    registro['horas_trabalhadas_minutos'] = calculo['horas_trabalhadas_minutos']
                    registro['horas_extras_formatado'] = format_minutes_to_time(calculo['horas_extras_minutos'])
            except Exception as e:
                print(f"Erro ao calcular horas extras: {str(e)}")
                # Continua o registro mesmo se falhar o cálculo
        
        # Salvar registro no DynamoDB
        print(f"[REGISTRO] Salvando registro: company_id={company_id}, key={registro['employee_id#date_time']}, tipo={tipo}")
        tabela_registros.put_item(Item=registro)
        print(f"[REGISTRO] ✅ Registro salvo com sucesso!")

        return jsonify({
            'success': True,
            'funcionario': funcionario_nome,
            'hora': data_hora_str,
            'tipo': tipo
        })

    except Exception as e:
        print(f"Erro ao registrar ponto: {str(e)}")
        return jsonify({'error': 'Erro ao registrar ponto'}), 500


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
        home_office = request.form.get('home_office', 'false').lower() == 'true'
        
        if not nome or not cargo:
            return jsonify({'error': 'Nome e cargo são obrigatórios'}), 400

        # Login de funcionário
        
        # Hash da senha se fornecida
        if senha and senha.strip():
            from auth import hash_password
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
            else:
                # definir para o padrão da empresa
                try:
                    cfg_resp = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
                    cfg = cfg_resp.get('Item', {})
                    funcionario['intervalo_emp'] = int(cfg.get('duracao_intervalo', 60))
                except Exception:
                    funcionario['intervalo_emp'] = 60
        
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
            from auth import hash_password
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
                    funcionario_item['intervalo_emp'] = int(cfg.get('duracao_intervalo', 60))
                except Exception:
                    funcionario_item['intervalo_emp'] = 60
        else:
            # FormData mode: use extracted form values
            if intervalo_personalizado:
                funcionario_item['intervalo_personalizado'] = True
                funcionario_item['intervalo_emp'] = intervalo_emp if intervalo_emp is not None else None
            else:
                funcionario_item['intervalo_personalizado'] = False
                # Puxar duração padrão da config da empresa
                try:
                    cfg_resp = tabela_configuracoes.get_item(Key={'company_id': empresa_id})
                    cfg = cfg_resp.get('Item', {})
                    funcionario_item['intervalo_emp'] = int(cfg.get('duracao_intervalo', 60))
                except Exception:
                    funcionario_item['intervalo_emp'] = 60
        
        # Salvar no DynamoDB (Employees table uses company_id as partition key)
        tabela_funcionarios.put_item(Item=funcionario_item)
        
        # Salvar horário pré-definido se fornecido
        if nome_horario and horario_entrada and horario_saida:
            try:
                # Buscar configuração existente
                response = tabela_configuracoes.get_item(
                    Key={
                        'company_id': empresa_id,
                        'config_key': 'horarios_preset'
                    }
                )
                
                config_item = response.get('Item', {})
                horarios = config_item.get('horarios', [])
                
                # Verificar se horário com esse nome já existe
                horario_existente = next((h for h in horarios if h['nome'] == nome_horario), None)
                
                if not horario_existente:
                    # Criar novo horário pré-definido
                    horario_id = str(uuid.uuid4())
                    horarios.append({
                        'id': horario_id,
                        'nome': nome_horario,
                        'horario_entrada': horario_entrada,
                        'horario_saida': horario_saida,
                        'data_criacao': datetime.now().isoformat()
                    })
                    
                    # Salvar de volta em ConfigCompany
                    config_item = {
                        'company_id': empresa_id,
                        'config_key': 'horarios_preset',
                        'horarios': horarios,
                        'updated_at': datetime.now().isoformat()
                    }
                    tabela_configuracoes.put_item(Item=config_item)
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
                funcionario = funcionarios_map.get(employee_id)
                
                if not funcionario:
                    continue
                    
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
                        
                        # Calcular usando calculate_overtime
                        calculo = calculate_overtime(
                            horario_entrada_esperado,
                            horario_saida_esperado,
                            horario_entrada_real,
                            horario_saida_real,
                            configuracoes,
                            intervalo_automatico,
                            duracao_intervalo
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
        
        # Buscar registros usando o novo schema (OTIMIZADO)
        try:
            print(f"[DEBUG RESUMO] Iniciando busca de registros - Período: {data_inicio} até {data_fim}")
            registros_raw = []
            func_ids = [f['id'] for f in funcionarios_filtrados]  # Removido limite para incluir todos os funcionários
            print(f"[DEBUG RESUMO] Buscando para {len(func_ids)} funcionários")
            # Buscar registros para cada funcionário (com limite)
            for i, func_id in enumerate(func_ids):
                print(f"[DEBUG RESUMO] Processando funcionário {i+1}/{len(func_ids)}: {func_id}")
                if data_inicio and data_fim:
                    # Usar scan por company_id e intervalo de data (aceitar tanto 'date_time' quanto 'data_hora')
                    start_ts = f"{data_inicio} 00:00:00"
                    end_ts = f"{data_fim} 23:59:59"
                    date_filter = Attr('date_time').between(start_ts, end_ts) | Attr('data_hora').between(start_ts, end_ts)
                    response = tabela_registros.scan(
                        FilterExpression=Attr('company_id').eq(empresa_id) & date_filter,
                        Limit=500
                    )
                else:
                    # Buscar por company_id e filtrar o employee_id localmente (alguns registros usam employee_id#date_time como chave)
                    response = tabela_registros.scan(
                        FilterExpression=Attr('company_id').eq(empresa_id),
                        Limit=200
                    )
                items = response.get('Items', [])
                # Filtrar itens para incluir tanto registros com atributo `employee_id`
                # quanto registros que usam a chave composta `employee_id#date_time`
                filtered_items = []
                for it in items:
                    emp_field = it.get('employee_id')
                    composite = it.get('employee_id#date_time') or it.get('employee_id_date_time') or ''
                    if emp_field and str(emp_field) == str(func_id):
                        filtered_items.append(it)
                        continue
                    if composite and str(composite).startswith(f"{func_id}#"):
                        filtered_items.append(it)
                        continue
                items = filtered_items
                print(f"[DEBUG RESUMO] Funcionário {func_id}: {len(items)} registros")
                registros_raw.extend(items)
            print(f"[DEBUG RESUMO] Registros raw encontrados: {len(registros_raw)}")
            # Inicializar registros
            registros = []
            for item in registros_raw:
                # Extrair campos do schema novo
                employee_id = item.get('employee_id')
                data_hora = item.get('date_time') or item.get('data_hora')
                tipo = item.get('type') or item.get('tipo')
                # Formatar data para DD-MM-YYYY HH:MM:SS
                data_hora_formatada = data_hora
                if data_hora:
                    try:
                        # Suporta tanto YYYY-MM-DD quanto DD-MM-YYYY
                        if '-' in data_hora:
                            partes = data_hora.split(' ')
                            if len(partes) == 2:
                                data_part, hora_part = partes
                                if data_part.count('-') == 2:
                                    # YYYY-MM-DD ou DD-MM-YYYY
                                    split = data_part.split('-')
                                    if len(split[0]) == 4:
                                        yyyy, mm, dd = split
                                        data_hora_formatada = f"{dd}-{mm}-{yyyy} {hora_part}"
                                    else:
                                        dd, mm, yyyy = split
                                        data_hora_formatada = f"{dd}-{mm}-{yyyy} {hora_part}"
                    except Exception as e:
                        print(f"[DEBUG RESUMO] Erro ao formatar data {data_hora}: {e}")
                        data_hora_formatada = data_hora
                registro_formatado = {
                    'employee_id': employee_id,
                    'data_hora': data_hora_formatada,
                    'tipo': tipo,
                }
                registros.append(registro_formatado)
            print(f"[DEBUG RESUMO] Registros formatados: {len(registros)}")
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
            horario_entrada_esperado = funcionario.get('horario_entrada')
            horario_saida_esperado = funcionario.get('horario_saida')
            
            print(f"[DEBUG RESUMO] Processando funcionário: {func_nome} ({func_id})")
            
            total_horas_trabalhadas_min = 0
            total_horas_extras_min = 0
            total_atrasos_min = 0
            
            # Se o funcionário tem registros
            if func_id in registros_por_funcionario_data:
                for data, regs_do_dia in registros_por_funcionario_data[func_id].items():
                    # Ordenar registros por hora
                    regs_do_dia.sort(key=lambda x: x['data_hora'])
                    
                    # Encontrar primeira entrada e última saída
                    entrada = None
                    saida = None

                    def _normalize_type(t):
                        if not t:
                            return ''
                        s = str(t).strip().lower()
                        s = s.replace('á', 'a').replace('ã', 'a').replace('â', 'a')
                        return s

                    for reg in regs_do_dia:
                        reg_tipo = _normalize_type(reg.get('tipo') or reg.get('type') or '')
                        # Considerar vários formatos comuns
                        is_entry = reg_tipo in ('entrada', 'in', 'retorno', 'return') or reg_tipo.startswith('entrada') or reg_tipo.startswith('retorno') or 'entry' in reg_tipo
                        is_exit = reg_tipo in ('saida', 'saída', 'out', 'intervalo', 'break_start') or reg_tipo.startswith('saida') or reg_tipo.startswith('intervalo') or 'out' in reg_tipo

                        if is_entry and not entrada:
                            entrada = reg['data_hora']
                        if is_exit:
                            # sempre atualizar para última saída encontrada
                            saida = reg['data_hora']
                    
                    if entrada and saida:
                        try:
                            # Converter para datetime (aceitar com e sem segundos)
                            def _try_parse_dt(value):
                                for fmt in ('%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M'):
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
                            
                            # Calcular horas trabalhadas brutas
                            horas_brutas = saida_dt - entrada_dt
                            horas_brutas_min = int(horas_brutas.total_seconds() / 60)
                            
                            # Subtrair intervalo se configurado (usar valor do funcionário quando disponível)
                            if intervalo_automatico:
                                intervalo_emp = funcionario.get('intervalo_emp', duracao_intervalo)
                                horas_brutas_min = max(0, horas_brutas_min - int(intervalo_emp or 0))
                            
                                    # Se tem horários esperados, calcular extras e atrasos
                            if horario_entrada_esperado and horario_saida_esperado:
                                try:
                                    entrada_esperada = datetime.strptime(f"{data} {horario_entrada_esperado}", '%d-%m-%Y %H:%M')
                                    saida_esperada = datetime.strptime(f"{data} {horario_saida_esperado}", '%d-%m-%Y %H:%M')
                                    
                                    # Atraso: minutos além da tolerância (desvio - tolerância)
                                    atraso_real = int((entrada_dt - entrada_esperada).total_seconds() / 60)
                                    atraso_min = atraso_real - tolerancia_atraso
                                    if atraso_min < 0:
                                        atraso_min = 0
                                    print(f"[DEBUG RESUMO] Entrada esperada: {entrada_esperada.strftime('%d-%m-%Y %H:%M')}, Entrada real: {entrada_dt.strftime('%d-%m-%Y %H:%M')}, Desvio: {atraso_real}min, Tolerancia: {tolerancia_atraso}min, Atraso calculado: {atraso_min}min")
                                    
                                    # Horas extras após saída esperada
                                    if saida_dt > saida_esperada:
                                        horas_extras = saida_dt - saida_esperada
                                        horas_extras_min_calc = int(horas_extras.total_seconds() / 60)
                                        
                                        # Arredondar horas extras
                                        if arredondamento_horas_extras > 0:
                                            # Contar apenas minutos além do bloco de arredondamento (ex: 11 -> 1 quando intervalo=10)
                                            horas_extras_min_calc = horas_extras_min_calc % arredondamento_horas_extras
                                        
                                        horas_extras_min = horas_extras_min_calc
                                    else:
                                        horas_extras_min = 0
                                    
                                    # Horas extras por entrada antecipada (se configurado)
                                    if hora_extra_entrada_antecipada and entrada_dt < entrada_esperada:
                                        antecipacao = entrada_esperada - entrada_dt
                                        antecipacao_min = int(antecipacao.total_seconds() / 60)
                                        if arredondamento_horas_extras > 0:
                                            antecipacao_min = antecipacao_min % arredondamento_horas_extras
                                        horas_extras_min += antecipacao_min
                                    
                                    # Horas trabalhadas = horário esperado (se trabalhou pelo menos isso)
                                    jornada_esperada_min = int((saida_esperada - entrada_esperada).total_seconds() / 60)
                                    if intervalo_automatico:
                                        jornada_esperada_min -= int(funcionario.get('intervalo_emp', duracao_intervalo) or 0)
                                    
                                    horas_trabalhadas_min = min(horas_brutas_min, jornada_esperada_min)
                                    
                                    total_horas_trabalhadas_min += horas_trabalhadas_min
                                    total_horas_extras_min += horas_extras_min
                                    total_atrasos_min += atraso_min
                                    
                                except Exception as e:
                                    print(f"[DEBUG RESUMO] Erro ao processar horários esperados: {e}")
                                    # Fallback: usar horas brutas
                                    total_horas_trabalhadas_min += horas_brutas_min
                            else:
                                # Sem horários esperados: todas são horas trabalhadas
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
    if not employee_id or not data_hora or not tipo:
        return jsonify({'mensagem': 'Funcionário, data/hora e tipo são obrigatórios'}), 400
        
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

    if tipo == 'entrada':
        horario_entrada_esperado = funcionario.get('horario_entrada')
        tolerancia_atraso = int(configuracoes.get('tolerancia_atraso', 5))
        if horario_entrada_esperado:
            from datetime import datetime, timedelta
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
                # Dentro da tolerância: arredonda para o horário esperado
                data_hora = f"{data_str} {horario_entrada_esperado}"
            elif diff_min <= tolerancia_atraso + 5:
                # Até 5 minutos após a tolerância: registra o ponto real, mas não conta atraso
                pass  # data_hora permanece, atraso será 0 no cálculo
            # Se passar de tolerancia+5, atraso será calculado normalmente

    # Preparar o registro base
    registro = {
        'company_id': empresa_id,           # Partition key
        'employee_id#date_time': sort_key,  # Sort key
        'registro_id': id_registro,
        'employee_id': employee_id,
        'data_hora': data_hora,
        'type': tipo,  # Padronizado para 'type'
        'method': 'MANUAL',  # Método de registro manual
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
                
                # Calcular
                calculo = calculate_overtime(
                    horario_entrada_esperado,
                    horario_saida_esperado,
                    horario_entrada_real,
                    horario_saida_real,
                    configuracoes,
                    configuracoes.get('intervalo_automatico', False),
                    funcionario.get('intervalo_emp', configuracoes.get('duracao_intervalo', 60))
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

    from auth import verify_password, get_secret_key
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
    
    from auth import hash_password
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
    
    from auth import verify_password, get_secret_key
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
            return jsonify({
                'nome': horario_encontrado['nome'],
                'horario_entrada': horario_encontrado['horario_entrada'],
                'horario_saida': horario_encontrado['horario_saida']
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
        
        if not all([nome, horario_entrada, horario_saida]):
            return jsonify({'error': 'nome, horario_entrada e horario_saida são obrigatórios'}), 400
        
        # Validar formato HH:MM
        import re
        time_pattern = r'^([01]\d|2[0-3]):([0-5]\d)$'
        if not re.match(time_pattern, horario_entrada) or not re.match(time_pattern, horario_saida):
            return jsonify({'error': 'Formato de horário inválido. Use HH:MM'}), 400
        
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
        
        if horario_existente:
            # Atualizar horário existente
            horario_existente['horario_entrada'] = horario_entrada
            horario_existente['horario_saida'] = horario_saida
        else:
            # Adicionar novo horário
            horario_id = str(uuid.uuid4())
            horarios.append({
                'id': horario_id,
                'nome': nome,
                'horario_entrada': horario_entrada,
                'horario_saida': horario_saida,
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
            'horario_entrada': horario_entrada,
            'horario_saida': horario_saida
        }), 201
        
    except Exception as e:
        print(f"Erro ao criar horário preset: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@routes.route('/horarios/<nome_horario>', methods=['DELETE'])
@token_required
def excluir_horario_preset(nome_horario, payload):
    """
    Exclui um horário pré-definido da empresa
    """
    try:
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
        horarios_filtrados = [h for h in horarios if h['nome'] != nome_horario]
        
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
            
            # Preparar item para salvar
            config_item = {
                'company_id': empresa_id,
                'tolerancia_atraso': tolerancia_atraso,
                'hora_extra_entrada_antecipada': hora_extra_entrada_antecipada,
                'arredondamento_horas_extras': arredondamento_horas_extras,
                'intervalo_automatico': intervalo_automatico,
                'duracao_intervalo': duracao_intervalo,
                'compensar_saldo_horas': compensar_saldo_horas,
                'exigir_localizacao': exigir_localizacao,
                'raio_permitido': raio_permitido,
                'data_atualizacao': datetime.now().isoformat(),
                'first_configuration_completed': True  # Marca que configuração inicial foi feita
            }
            
            # Adicionar coordenadas se fornecidas
            if latitude_empresa is not None:
                config_item['latitude_empresa'] = float(latitude_empresa)
            if longitude_empresa is not None:
                config_item['longitude_empresa'] = float(longitude_empresa)
            
            # Salvar configurações
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
        tipo = data.get('tipo', 'entrada')  # entrada ou saida
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

        # Criar registro com schema correto da tabela TimeRecords
        # HASH: company_id, RANGE: employee_id#date_time
        # Optionally store accuracy and provider for auditing
        user_accuracy = data.get('accuracy') or data.get('accuracy_meters') or data.get('user_accuracy')
        registro_item = {
            'company_id': company_id,  # HASH key
            'employee_id#date_time': f"{funcionario_id}#{data_hora_atual}",  # RANGE key
            'data_hora': data_hora_atual,  # Sempre presente e igual ao usado na chave composta
            'employee_id': funcionario_id,
            'type': tipo,  # Padronizado para 'type'
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
        
        response_data = {
            'success': True,
            'message': f'Ponto de {tipo} registrado com sucesso!',
            'data_hora': data_hora_atual,
            'tipo': tipo,
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