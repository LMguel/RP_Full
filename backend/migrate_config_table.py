"""
Script de migração da tabela ConfigCompany
Converte estrutura plana para estrutura hierárquica organizada
"""
import boto3
from datetime import datetime
from decimal import Decimal

# Configuração AWS
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
tabela_configuracoes = dynamodb.Table('ConfigCompany')

def migrar_configuracao_antiga_para_nova(config_antiga):
    """
    Converte configuração no formato antigo para o novo formato hierárquico
    
    Args:
        config_antiga: Dict com estrutura plana atual
        
    Returns:
        Dict com nova estrutura hierárquica
    """
    
    # Valores padrão caso não existam
    config_nova = {
        'company_id': config_antiga.get('company_id'),
        'data_atualizacao': datetime.now().isoformat(),
        
        # Dias úteis padrão: Segunda a Sexta
        'work_days': ['mon', 'tue', 'wed', 'thu', 'fri'],
        
        # Horários de trabalho
        'work_hours': {
            'default_start': '08:00',  # Padrão se não especificado
            'default_end': '17:00',
            'break_duration': config_antiga.get('duracao_intervalo', 60),  # em minutos
            'intervalo_automatico': bool(config_antiga.get('intervalo_automatico', False))
        },
        
        # Regras de arredondamento e tolerância
        'rounding_rules': {
            'tolerance_before': int(config_antiga.get('tolerancia_atraso', 5)),  # minutos antes
            'tolerance_after': int(config_antiga.get('tolerancia_atraso', 5)),   # minutos depois
            'round_to_nearest': _converter_arredondamento(config_antiga.get('arredondamento_horas_extras', '5'))
        },
        
        # Regras de hora extra
        'extra_time_rules': {
            'count_early_as_extra': bool(config_antiga.get('hora_extra_entrada_antecipada', False)),
            'count_late_as_extra': True  # Sempre contar saída tarde como extra
        },
        
        # Compensação automática de saldo
        'auto_compensation': bool(config_antiga.get('compensar_saldo_horas', False)),
        
        # Regras de localização
        'location_rules': {
            'exigir_localizacao': bool(config_antiga.get('exigir_localizacao', False)),
            'raio_permitido': int(config_antiga.get('raio_permitido', 100)),  # metros
            'latitude_empresa': config_antiga.get('latitude_empresa'),
            'longitude_empresa': config_antiga.get('longitude_empresa')
        },
        
        # Política de feriados
        'holiday_policy': 'ignore',  # 'ignore', 'count_as_work', 'require_double_pay'
        'custom_holidays': [],  # Lista de datas no formato YYYY-MM-DD
        
        # Política de finais de semana
        'weekend_policy': {
            'enabled': False,
            'default_hours': {
                'sat': '00:00',
                'sun': '00:00'
            }
        },
        
        # Metadados de migração
        '_migration': {
            'migrated_at': datetime.now().isoformat(),
            'migrated_from_version': 'v1_flat',
            'migration_version': 'v2_hierarchical'
        }
    }
    
    return config_nova

def _converter_arredondamento(valor_antigo):
    """Converte valor de arredondamento do formato antigo para número"""
    if valor_antigo == 'exato':
        return 0
    try:
        return int(valor_antigo)
    except:
        return 5  # padrão

def migrar_todas_configuracoes(dry_run=True):
    """
    Migra todas as configurações da tabela
    
    Args:
        dry_run: Se True, apenas simula sem salvar no banco
    """
    print("=" * 70)
    print("MIGRAÇÃO DA TABELA ConfigCompany")
    print("=" * 70)
    print(f"Modo: {'DRY RUN (simulação)' if dry_run else 'EXECUÇÃO REAL'}")
    print()
    
    # Buscar todas as configurações com paginação completa
    configuracoes = []
    last_evaluated_key = None
    
    while True:
        if last_evaluated_key:
            response = tabela_configuracoes.scan(ExclusiveStartKey=last_evaluated_key)
        else:
            response = tabela_configuracoes.scan()
        
        configuracoes.extend(response.get('Items', []))
        
        last_evaluated_key = response.get('LastEvaluatedKey')
        if not last_evaluated_key:
            break
    
    print(f"📊 Encontradas {len(configuracoes)} configurações para migrar")
    print()
    
    sucesso = 0
    erros = 0
    
    for config_antiga in configuracoes:
        company_id = config_antiga.get('company_id')
        print(f"🏢 Processando empresa: {company_id}")
        
        try:
            # Converter para novo formato
            config_nova = migrar_configuracao_antiga_para_nova(config_antiga)
            
            # Mostrar comparação
            print(f"  ✓ Estrutura antiga: {len(config_antiga)} campos planos")
            print(f"  ✓ Estrutura nova: {len(config_nova)} campos organizados")
            
            if not dry_run:
                # Salvar no banco
                tabela_configuracoes.put_item(Item=config_nova)
                print(f"  ✅ Migração salva no DynamoDB")
            else:
                print(f"  ⚠️  Simulação - não salvo (use dry_run=False para salvar)")
            
            sucesso += 1
            print()
            
        except Exception as e:
            print(f"  ❌ ERRO: {str(e)}")
            erros += 1
            print()
    
    # Resumo
    print("=" * 70)
    print("RESUMO DA MIGRAÇÃO")
    print("=" * 70)
    print(f"✅ Sucesso: {sucesso}")
    print(f"❌ Erros: {erros}")
    print(f"📊 Total: {len(configuracoes)}")
    print()
    
    if dry_run:
        print("⚠️  Esta foi uma SIMULAÇÃO. Execute com dry_run=False para aplicar.")
    else:
        print("✅ Migração concluída e salva no DynamoDB!")
    
    return sucesso, erros

def verificar_migracao():
    """Verifica se alguma configuração já foi migrada"""
    response = tabela_configuracoes.scan()
    configuracoes = response.get('Items', [])
    
    migradas = 0
    nao_migradas = 0
    
    for config in configuracoes:
        if '_migration' in config:
            migradas += 1
        else:
            nao_migradas += 1
    
    print(f"📊 Status da migração:")
    print(f"  ✅ Migradas: {migradas}")
    print(f"  ⏳ Pendentes: {nao_migradas}")
    print(f"  📦 Total: {len(configuracoes)}")
    
    return migradas, nao_migradas

if __name__ == "__main__":
    import sys
    
    # Verificar status primeiro
    print("\n🔍 Verificando status atual...\n")
    verificar_migracao()
    print()
    
    # Perguntar se deseja continuar
    if len(sys.argv) > 1 and sys.argv[1] == '--execute':
        print("⚠️  MODO DE EXECUÇÃO REAL ATIVADO")
        resposta = input("Tem certeza que deseja migrar TODAS as configurações? (sim/não): ")
        if resposta.lower() == 'sim':
            migrar_todas_configuracoes(dry_run=False)
        else:
            print("❌ Migração cancelada pelo usuário")
    else:
        print("🔄 Executando migração em modo DRY RUN (simulação)...")
        print("   Para executar de verdade, use: python migrate_config_table.py --execute\n")
        migrar_todas_configuracoes(dry_run=True)
