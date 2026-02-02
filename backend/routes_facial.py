"""
ROTAS DE RECONHECIMENTO FACIAL
Endpoints para registro de ponto usando AWS Rekognition
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import pytz
import os
import uuid
import tempfile
from werkzeug.utils import secure_filename
from auth import verify_token
from functools import wraps
from aws_utils import reconhecer_funcionario, tabela_funcionarios, tabela_registros, enviar_s3, tabela_configuracoes

routes_facial = Blueprint('routes_facial', __name__)

# CORS configurado globalmente no app.py

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


@routes_facial.route('/api/reconhecer_rosto', methods=['POST', 'OPTIONS'])
@token_required
def reconhecer_rosto(payload):
    """
    Endpoint para reconhecimento facial
    Recebe imagem, procura na collection do Rekognition
    Retorna dados do funcionário se reconhecido
    """
    try:
        print("[FACIAL] ========== INÍCIO RECONHECIMENTO ==========")
        print(f"[FACIAL] Recebida requisição de reconhecimento")
        print(f"[FACIAL] Content-Type: {request.content_type}")
        print(f"[FACIAL] Files recebidos: {list(request.files.keys())}")
        print(f"[FACIAL] Form data: {list(request.form.keys())}")
        
        # Verificar se tem imagem
        if 'image' not in request.files:
            print("[FACIAL] Erro: Nenhuma imagem enviada")
            print(f"[FACIAL] Files disponíveis: {list(request.files.keys())}")
            return jsonify({
                'reconhecido': False,
                'error': 'Nenhuma imagem enviada'
            }), 400
        
        file = request.files['image']
        print(f"[FACIAL] Arquivo recebido: {file.filename}, Content-Type: {file.content_type}")
        
        if file.filename == '':
            print("[FACIAL] Erro: Nome de arquivo vazio")
            return jsonify({
                'reconhecido': False,
                'error': 'Nome de arquivo vazio'
            }), 400
        
        # Salvar temporariamente usando diretório temp do sistema (Windows/Linux)
        filename = secure_filename(f"temp_{uuid.uuid4()}.jpg")
        temp_path = os.path.join(tempfile.gettempdir(), filename)
        file.save(temp_path)
        
        print(f"[FACIAL] Imagem salva temporariamente em: {temp_path}")
        print(f"[FACIAL] Tamanho do arquivo: {os.path.getsize(temp_path)} bytes")
        
        # Reconhecer usando Rekognition
        external_id = reconhecer_funcionario(temp_path)
        
        # Remover arquivo temporário
        try:
            os.remove(temp_path)
            print(f"[FACIAL] Arquivo temporário removido")
        except:
            pass
        
        if not external_id:
            print("[FACIAL] Nenhum rosto reconhecido")
            return jsonify({
                'reconhecido': False,
                'mensagem': 'Nenhum rosto correspondente encontrado'
            }), 200
        
        # Buscar dados do funcionário no DynamoDB
        # O external_id vem no formato: "company_id_employee_id" (separado por _)
        # Ex: "733845ea-2786-4f23-9a1a-7b98df54c4be_luis_miguel_051398"
        print(f"[FACIAL] Buscando funcionário com ExternalId: {external_id}")
        
        funcionario = None
        company_id = None
        employee_id = None
        
        # Tentar extrair company_id (UUID) e employee_id do formato "company_id_employee_id"
        # O company_id é um UUID (36 caracteres com hífens)
        if '_' in external_id and len(external_id) > 36:
            # O company_id é um UUID, então tem 36 caracteres
            # Formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx_employee_id
            company_id = external_id[:36]  # UUID tem 36 chars
            employee_id = external_id[37:]  # Pular o _ após o UUID
            print(f"[FACIAL] Formato composto detectado - company_id: {company_id}, employee_id: {employee_id}")
            
            try:
                response = tabela_funcionarios.get_item(
                    Key={
                        'company_id': company_id,
                        'id': employee_id
                    }
                )
                funcionario = response.get('Item')
                if funcionario:
                    print(f"[FACIAL] Funcionário encontrado via get_item!")
                    print(f"[FACIAL] Dados completos: {funcionario}")
            except Exception as e:
                print(f"[FACIAL] Erro ao buscar com chave composta: {e}")
        
        # Se não encontrou, tentar buscar por scan usando o employee_id extraído ou external_id completo
        if not funcionario:
            search_id = employee_id if employee_id else external_id
            print(f"[FACIAL] Tentando scan por employee_id: {search_id}")
            try:
                # Tentar get_item com chaves alternativas (em alguns dados legados o campo pode ser 'employee_id')
                try:
                    # Tentar get_item usando a chave primária correta da tabela Employees ('id')
                    response_alt = tabela_funcionarios.get_item(
                        Key={
                            'company_id': company_id,
                            'id': search_id
                        }
                    )
                    # Debug: mostrar chaves/estrutura retornada
                    print(f"[FACIAL][DBG] get_item (employee_id) response keys: {list(response_alt.keys())}")
                    funcionario = response_alt.get('Item')
                    if funcionario:
                        print(f"[FACIAL] Funcionário encontrado via get_item (employee_id): {funcionario.get('name')}")
                    else:
                        print(f"[FACIAL][DBG] get_item (employee_id) não retornou Item para key company_id={company_id}, employee_id={search_id}")
                except Exception as ex:
                    print(f"[FACIAL][DBG] Exceção em get_item(employee_id): {ex}")
                    funcionario = funcionario

                # Se ainda não encontrou, tentar variações por scan (contains / equals)
                if not funcionario:
                    from boto3.dynamodb.conditions import Attr

                    # Gerar variações comuns do identificador
                    variants = [search_id]
                    variants.append(search_id.replace('_', '-'))
                    variants.append(search_id.replace('_', ' '))
                    # última parte depois do último underscore (por exemplo, nomes que incluem company prefix)
                    if '_' in search_id:
                        variants.append(search_id.split('_')[-1])

                    # Antes do scan, tentar query eficiente usando company_id + begins_with(id)
                    try:
                        from boto3.dynamodb.conditions import Key
                        for v in variants:
                            print(f"[FACIAL][DBG] Tentando query por company_id={company_id} e id begins_with {v}")
                            try:
                                qresp = tabela_funcionarios.query(
                                    KeyConditionExpression=Key('company_id').eq(company_id) & Key('id').begins_with(v),
                                    Limit=5
                                )
                                qitems = qresp.get('Items', [])
                                print(f"[FACIAL][DBG] query retornou {len(qitems)} items para prefix {v}")
                                if qitems:
                                    funcionario = qitems[0]
                                    print(f"[FACIAL] Funcionário encontrado via query: {funcionario.get('name')}")
                                    break
                            except Exception as qe:
                                print(f"[FACIAL][DBG] Exceção em query begins_with para {v}: {qe}")
                        if funcionario:
                            # pular o scan se já achou
                            pass
                    except Exception as qe_outer:
                        print(f"[FACIAL][DBG] Erro ao tentar query por prefixos: {qe_outer}")

                    # Construir expressão dinâmica: (id = v OR employee_id = v OR id contains v OR employee_id contains v ...)
                    filter_expr = None
                    for v in variants:
                        eq_expr = (Attr('id').eq(v) | Attr('employee_id').eq(v) | Attr('external_id').eq(v))
                        contains_expr = (Attr('id').contains(v) | Attr('employee_id').contains(v) | Attr('external_id').contains(v))
                        combined = eq_expr | contains_expr
                        filter_expr = combined if filter_expr is None else (filter_expr | combined)

                    # Executar scan com a expressão construída
                    response = tabela_funcionarios.scan(
                        FilterExpression=filter_expr,
                        Limit=10
                    )
                    items = response.get('Items', [])
                    print(f"[FACIAL][DBG] scan retornou {len(items)} items")
                    if items:
                        # mostrar até 3 itens para debug
                        preview = items[:3]
                        print(f"[FACIAL][DBG] primeiros items do scan: {preview}")
                        funcionario = items[0]
                        print(f"[FACIAL] Funcionário encontrado via scan: {funcionario.get('name')}")
            except Exception as e:
                print(f"[FACIAL] Erro no scan: {e}")
        
        if not funcionario:
            # Debug: listar alguns itens da tabela Employees para inspecionar estrutura/nomes de campos
            try:
                from boto3.dynamodb.conditions import Attr
                resp_debug = tabela_funcionarios.scan(
                    FilterExpression=Attr('company_id').eq(company_id),
                    Limit=10
                )
                debug_items = resp_debug.get('Items', [])
                print(f"[FACIAL][DBG] Lista de até 10 funcionários da company {company_id}: count={len(debug_items)}")
                for idx, itm in enumerate(debug_items[:5]):
                    keys = list(itm.keys())
                    # mostrar apenas alguns campos para não vazar dados sensíveis demais
                    preview = {k: itm.get(k) for k in keys[:5]}
                    print(f"[FACIAL][DBG] item[{idx}] keys: {keys} preview: {preview}")
                    # Mostrar valores importantes para diagnóstico
                    try:
                        print(f"[FACIAL][DBG] item[{idx}] values: id={itm.get('id')}, login={itm.get('login')}, nome={itm.get('nome')}, face_id={itm.get('face_id')}, foto_url={itm.get('foto_url')}")
                    except Exception as _:
                        pass

                # Tentar casar localmente o search_id contra campos comuns dos itens retornados
                try:
                    for itm in debug_items:
                        if funcionario:
                            break
                        for field in ['id', 'employee_id', 'login', 'nome', 'face_id', 'foto_url']:
                            val = itm.get(field)
                            if not val:
                                continue
                            # Normalizar para comparação simples
                            sval = str(val).lower()
                            ssearch = str(search_id).lower()
                            if sval == ssearch or ssearch in sval or sval.endswith(ssearch) or sval.replace('_','').replace('-','') == ssearch.replace('_','').replace('-',''):
                                funcionario = itm
                                print(f"[FACIAL][DBG] Encontrado match local via campo '{field}': {val}")
                                break
                except Exception as me:
                    print(f"[FACIAL][DBG] Erro ao tentar match local nos itens: {me}")
            except Exception as de:
                print(f"[FACIAL][DBG] Erro ao listar funcionários para debug: {de}")

            print(f"[FACIAL] Erro: Funcionário {external_id} não encontrado no banco")
            return jsonify({
                'reconhecido': False,
                'error': 'Funcionário não encontrado no sistema'
            }), 404
        
        # Determinar o ID correto do funcionário
        func_id = funcionario.get('id') or funcionario.get('employee_id') or external_id
        func_company_id = funcionario.get('company_id', '')
        
        # Tentar diferentes campos de nome (a tabela pode usar 'name', 'nome', 'full_name', etc)
        nome_funcionario = (
            funcionario.get('name') or 
            funcionario.get('nome') or 
            funcionario.get('full_name') or 
            funcionario.get('employee_name') or
            func_id  # Usar ID como fallback
        )
        
        print(f"[FACIAL] Funcionário reconhecido: {nome_funcionario}")
        
        # Determinar o PRÓXIMO tipo de registro (entrada ou saída) baseado no último registro DO DIA
        from boto3.dynamodb.conditions import Attr
        proximo_tipo = 'entrada'  # Padrão: primeiro registro do dia é entrada
        tz = pytz.timezone('America/Sao_Paulo')
        hoje = datetime.now(tz).strftime('%Y-%m-%d')
        
        try:
            # Buscar registros do funcionário de HOJE
            response = tabela_registros.scan(
                FilterExpression=Attr('employee_id').eq(func_id)
            )
            todos_registros = response.get('Items', [])
            
            # Filtrar apenas registros de HOJE
            registros_hoje = []
            for reg in todos_registros:
                if reg.get('date') == hoje:
                    registros_hoje.append(reg)
                elif reg.get('timestamp', '').startswith(hoje):
                    registros_hoje.append(reg)
                elif hoje in reg.get('data_hora', '')[:10]:
                    registros_hoje.append(reg)
                elif hoje in reg.get('employee_id#date_time', ''):
                    registros_hoje.append(reg)
            
            if registros_hoje:
                # Verificar se já houve uma entrada hoje
                teve_entrada = any(
                    (reg.get('type') or reg.get('tipo') or reg.get('tipo_registro', '')).lower() == 'entrada'
                    for reg in registros_hoje
                )
                proximo_tipo = 'saida' if teve_entrada else 'entrada'
                print(f"[FACIAL] Já teve entrada hoje: {teve_entrada} -> próximo: {proximo_tipo}")
            else:
                print(f"[FACIAL] Nenhum registro hoje, próximo será: entrada")
        except Exception as e:
            print(f"[FACIAL] Erro ao verificar último registro: {e}")
        
        # Retornar dados do funcionário com próximo tipo esperado
        return jsonify({
            'reconhecido': True,
            'funcionario': {
                'funcionario_id': func_id,
                'company_id': func_company_id,
                'nome': nome_funcionario,
                'cargo': funcionario.get('position') or funcionario.get('cargo', ''),
                'foto_url': funcionario.get('photo_url') or funcionario.get('foto_url', '')
            },
            'proximo_tipo': proximo_tipo,  # entrada ou saida
            'confianca': 95.0  # Rekognition retorna isso, podemos adicionar depois
        }), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[FACIAL] ========== ERRO NO RECONHECIMENTO ==========")
        print(f"[FACIAL] Erro: {str(e)}")
        print(f"[FACIAL] Tipo do erro: {type(e).__name__}")
        print(f"[FACIAL] Traceback completo:")
        print(error_trace)
        print(f"[FACIAL] ============================================")
        return jsonify({
            'reconhecido': False,
            'error': f'Erro no reconhecimento: {str(e)}',
            'error_type': type(e).__name__
        }), 500


@routes_facial.route('/api/registrar_ponto_facial', methods=['POST', 'OPTIONS'])
@token_required
def registrar_ponto_facial(payload):
    """
    Registra ponto após reconhecimento facial bem-sucedido
    Determina automaticamente se é entrada ou saída
    """
    try:
        data = request.get_json()
        print(f"[FACIAL] Recebida requisição de registro: {data}")
        
        funcionario_id = data.get('funcionario_id')
        company_id = payload.get('company_id')
        
        if not funcionario_id:
            return jsonify({'error': 'funcionario_id é obrigatório'}), 400
        
        if not company_id:
            return jsonify({'error': 'company_id não encontrado no token'}), 400
        
        # Buscar último registro do funcionário para determinar entrada/saída
        # A tabela TimeRecords usa employee_id#date_time como partition key
        from boto3.dynamodb.conditions import Key, Attr

        tz = pytz.timezone('America/Sao_Paulo')
        hoje = datetime.now(tz).strftime('%Y-%m-%d')
        
        # Buscar registros de HOJE usando scan
        # Suportar registros que usam 'date' ou que têm a data no timestamp/data_hora
        try:
            # Primeiro, buscar por employee_id e filtrar por data
            response = tabela_registros.scan(
                FilterExpression=Attr('employee_id').eq(funcionario_id)
            )
            todos_registros = response.get('Items', [])
            
            # Filtrar apenas registros de HOJE
            registros_hoje = []
            for reg in todos_registros:
                # Verificar campo 'date' primeiro
                if reg.get('date') == hoje:
                    registros_hoje.append(reg)
                    continue
                    
                # Verificar timestamp (ISO format: 2024-12-12T10:30:00)
                timestamp = reg.get('timestamp', '')
                if timestamp and timestamp.startswith(hoje):
                    registros_hoje.append(reg)
                    continue
                    
                # Verificar data_hora (format: 2024-12-12 10:30:00 ou similar)
                data_hora = reg.get('data_hora', '')
                if data_hora and hoje in data_hora[:10]:
                    registros_hoje.append(reg)
                    continue
                    
                # Verificar chave composta employee_id#date_time
                composite = reg.get('employee_id#date_time', '')
                if composite and hoje in composite:
                    registros_hoje.append(reg)
            
            # Ordenar por timestamp para pegar o mais recente
            def get_sort_key(r):
                return r.get('timestamp', r.get('data_hora', r.get('employee_id#date_time', '')))
            
            registros_hoje.sort(key=get_sort_key, reverse=True)
            
            print(f"[FACIAL] Registros hoje para {funcionario_id}: {len(registros_hoje)}")
            if registros_hoje:
                print(f"[FACIAL] Último registro: {registros_hoje[0]}")
        except Exception as e:
            print(f"[FACIAL] Erro ao buscar registros: {e}")
            import traceback
            traceback.print_exc()
            registros_hoje = []
        
        # Determinar tipo (entrada ou saída): se já houve entrada hoje, registrar saída; senão, entrada
        tipo = 'entrada'  # Padrão: entrada se nenhum registro hoje
        if registros_hoje:
            # Verificar se já houve uma entrada hoje
            teve_entrada = any(
                (reg.get('type') or reg.get('tipo') or reg.get('tipo_registro', '')).lower() == 'entrada'
                for reg in registros_hoje
            )
            tipo = 'saida' if teve_entrada else 'entrada'
            print(f"[FACIAL] Já teve entrada hoje: {teve_entrada}, novo será '{tipo}'")
        else:
            print(f"[FACIAL] Nenhum registro hoje, será ENTRADA")
        
        print(f"[FACIAL] Tipo determinado: {tipo}")
        
        # Obter localização da empresa do DynamoDB ConfigCompany
        from decimal import Decimal
        
        location_lat = Decimal('0')
        location_lon = Decimal('0')
        try:
            config_response = tabela_configuracoes.get_item(Key={'company_id': company_id})
            if 'Item' in config_response:
                config = config_response['Item']
                location_lat = Decimal(str(config.get('latitude', 0)))
                location_lon = Decimal(str(config.get('longitude', 0)))
        except Exception as e:
            print(f"[FACIAL] Aviso: Não foi possível obter localização da empresa: {e}")
        
        # Criar registro
        agora = datetime.now(tz)
        timestamp_iso = agora.isoformat()
        
        # Formato da chave composta: employee_id#date_time
        date_time_str = agora.strftime('%Y-%m-%d %H:%M:%S')
        composite_key = f"{funcionario_id}#{date_time_str}"
        
        registro = {
            'company_id': company_id,  # Chave primária
            'employee_id#date_time': composite_key,
            'employee_id': funcionario_id,
            'timestamp': timestamp_iso,
            'data_hora': date_time_str,  # Adicionado para padronizar com TimeRecords
            'date': agora.strftime('%Y-%m-%d'),
            'time': agora.strftime('%H:%M:%S'),
            'type': tipo,
            'method': 'CAMERA',  # Reconhecimento facial
            'location': {
                'latitude': location_lat,
                'longitude': location_lon
            },
            'distance_from_company': Decimal('0')  # Na empresa (quiosque)
        }
        
        # Salvar no DynamoDB
        tabela_registros.put_item(Item=registro)
        
        print(f"[FACIAL] Registro salvo com sucesso: {composite_key}")
        
        return jsonify({
            'success': True,
            'tipo': tipo,
            'timestamp': timestamp_iso,
            'mensagem': f'Ponto de {tipo} registrado com sucesso!',
            'registro': {
                'tipo': tipo,
                'horario': agora.strftime('%H:%M:%S'),
                'data': agora.strftime('%d/%m/%Y'),
                'metodo': 'reconhecimento_facial'
            }
        }), 200
        
    except Exception as e:
        import traceback
        print(f"[FACIAL] Erro ao registrar ponto: {str(e)}")
        print(f"[FACIAL] Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': f'Erro ao registrar ponto: {str(e)}'
        }), 500


# Health check
@routes_facial.route('/api/facial/health', methods=['GET'])
def health_check():
    """Verifica se o serviço de reconhecimento facial está ativo"""
    from aws_utils import rekognition, COLLECTION
    
    status = {
        'status': 'ok',
        'rekognition_enabled': rekognition is not None,
        'collection': COLLECTION if rekognition else None
    }
    
    return jsonify(status), 200
