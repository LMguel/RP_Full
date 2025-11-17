"""
Script para criar dados de teste de outubro com 20 funcionários
Login: aaa / Senha: aaaaaa
"""
import boto3
import bcrypt
import uuid
from datetime import datetime, timedelta
import random
from zoneinfo import ZoneInfo

# Configuração
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table_employees = dynamodb.Table('Employees')
table_records = dynamodb.Table('TimeRecords')
table_users = dynamodb.Table('UserCompany')

# Criar empresa e usuário admin se não existir
def criar_empresa_admin():
    """Cria empresa e usuário admin"""
    company_id = "empresa_teste_outubro"
    
    # Verificar se usuário já existe
    try:
        response = table_users.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('username').eq('aaa')
        )
        if response.get('Items'):
            print("✅ Usuário 'aaa' já existe")
            existing_company = response['Items'][0].get('company_id')
            return existing_company
    except:
        pass
    
    # Criar usuário admin
    senha_hash = bcrypt.hashpw('aaaaaa'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_item = {
        'user_id': str(uuid.uuid4()),
        'username': 'aaa',
        'senha_hash': senha_hash,
        'company_id': company_id,
        'empresa_nome': 'Empresa Teste Outubro',
        'role': 'admin'
    }
    
    table_users.put_item(Item=user_item)
    print(f"✅ Usuário 'aaa' criado com company_id: {company_id}")
    
    return company_id

# Nomes de funcionários
NOMES_FUNCIONARIOS = [
    "João Silva", "Maria Santos", "Pedro Oliveira", "Ana Costa",
    "Carlos Souza", "Julia Lima", "Rafael Almeida", "Fernanda Rocha",
    "Bruno Martins", "Camila Ferreira", "Lucas Pereira", "Beatriz Dias",
    "Matheus Cardoso", "Larissa Ribeiro", "Gabriel Monteiro", "Isabela Barbosa",
    "Thiago Araújo", "Mariana Carvalho", "Felipe Gomes", "Patricia Nunes"
]

def criar_funcionarios(company_id):
    """Cria 20 funcionários"""
    print("\n" + "="*80)
    print("CRIANDO FUNCIONÁRIOS")
    print("="*80)
    
    funcionarios = []
    
    for i, nome in enumerate(NOMES_FUNCIONARIOS):
        emp_id = f"func_{i+1:03d}"
        
        employee = {
            'company_id': company_id,
            'id': emp_id,
            'nome': nome,
            'cargo': random.choice(['Desenvolvedor', 'Analista', 'Coordenador', 'Assistente']),
            'empresa_nome': 'Empresa Teste Outubro',
            'horario_entrada': '07:30',
            'horario_saida': '17:00',
            'is_active': True,
            'ativo': True,
            'deleted_at': None,
            'data_cadastro': '2024-10-01',
            'home_office': False
        }
        
        table_employees.put_item(Item=employee)
        funcionarios.append(employee)
        print(f"✅ {nome} (ID: {emp_id})")
    
    print(f"\n📊 Total: {len(funcionarios)} funcionários criados")
    return funcionarios

def gerar_horario_com_variacao(hora_base, tipo='entrada'):
    """Gera horário com variações de atraso/antecipação"""
    hora, minuto = map(int, hora_base.split(':'))
    
    variacao = random.choice([
        0,      # Pontual (40% de chance)
        0,
        0,
        0,
        -10,    # 10 min antecipado (10%)
        5,      # 5 min atraso (10%)
        10,     # 10 min atraso (10%)
        15,     # 15 min atraso (10%)
        -20,    # 20 min antecipado - hora extra (10%)
        30      # 30 min hora extra na saída (10%)
    ])
    
    # Aplicar variação
    total_minutos = hora * 60 + minuto + variacao
    nova_hora = total_minutos // 60
    novo_minuto = total_minutos % 60
    
    return f"{nova_hora:02d}:{novo_minuto:02d}:00"

def criar_registros_outubro(company_id, funcionarios):
    """Cria registros de ponto para dias úteis de outubro"""
    print("\n" + "="*80)
    print("CRIANDO REGISTROS DE OUTUBRO")
    print("="*80)
    
    # Dias úteis de outubro de 2024 (excluindo finais de semana)
    inicio = datetime(2024, 10, 1)
    fim = datetime(2024, 10, 31)
    
    total_registros = 0
    dias_uteis = []
    
    # Gerar lista de dias úteis
    current = inicio
    while current <= fim:
        # 0 = segunda, 6 = domingo
        if current.weekday() < 5:  # Segunda a sexta
            dias_uteis.append(current)
        current += timedelta(days=1)
    
    print(f"📅 Total de dias úteis em outubro/2024: {len(dias_uteis)}")
    
    # Para cada funcionário
    for func in funcionarios:
        emp_id = func['id']
        emp_nome = func['nome']
        
        # Simular algumas faltas aleatórias (5% de chance por dia)
        faltas = random.sample(dias_uteis, k=random.randint(0, 2))
        
        for dia in dias_uteis:
            # Verificar se faltou
            if dia in faltas:
                continue
            
            data_str = dia.strftime('%Y-%m-%d')
            
            # ENTRADA
            hora_entrada = gerar_horario_com_variacao('07:30', 'entrada')
            data_hora_entrada = f"{data_str} {hora_entrada}"
            
            registro_entrada = {
                'company_id': company_id,
                'employee_id#date_time': f"{emp_id}#{data_hora_entrada}",
                'registro_id': str(uuid.uuid4()),
                'funcionario_id': emp_id,
                'employee_id': emp_id,
                'funcionario_nome': emp_nome,
                'data_hora': data_hora_entrada,
                'tipo': 'entrada',
                'empresa_nome': 'Empresa Teste Outubro'
            }
            
            table_records.put_item(Item=registro_entrada)
            total_registros += 1
            
            # SAÍDA (1 hora de almoço = 60 minutos)
            hora_saida = gerar_horario_com_variacao('17:00', 'saida')
            data_hora_saida = f"{data_str} {hora_saida}"
            
            registro_saida = {
                'company_id': company_id,
                'employee_id#date_time': f"{emp_id}#{data_hora_saida}",
                'registro_id': str(uuid.uuid4()),
                'funcionario_id': emp_id,
                'employee_id': emp_id,
                'funcionario_nome': emp_nome,
                'data_hora': data_hora_saida,
                'tipo': 'saída',
                'empresa_nome': 'Empresa Teste Outubro'
            }
            
            table_records.put_item(Item=registro_saida)
            total_registros += 1
        
        print(f"✅ {emp_nome}: {len(dias_uteis) - len(faltas)} dias trabalhados, {len(faltas)} faltas")
    
    print(f"\n📊 Total: {total_registros} registros criados")

def main():
    print("="*80)
    print("CRIANDO DADOS DE TESTE - OUTUBRO 2024")
    print("="*80)
    print("\n📋 Configuração:")
    print("  - Login: aaa")
    print("  - Senha: aaaaaa")
    print("  - 20 funcionários")
    print("  - Dias úteis de outubro/2024")
    print("  - Horário: 07:30 - 17:00")
    print("  - Intervalo almoço: 60 minutos")
    print("  - Variações: atrasos e horas extras")
    
    confirm = input("\n⚠️  Confirmar criação dos dados? (sim/não): ")
    if confirm.lower() != 'sim':
        print("Operação cancelada.")
        return
    
    # 1. Criar empresa e admin
    company_id = criar_empresa_admin()
    
    # 2. Criar funcionários
    funcionarios = criar_funcionarios(company_id)
    
    # 3. Criar registros
    criar_registros_outubro(company_id, funcionarios)
    
    print("\n" + "="*80)
    print("✅ DADOS DE TESTE CRIADOS COM SUCESSO!")
    print("="*80)
    print("\n🔑 Credenciais de acesso:")
    print("  Login: aaa")
    print("  Senha: aaaaaa")
    print(f"\n🏢 Company ID: {company_id}")
    print(f"👥 Funcionários: {len(funcionarios)}")
    print(f"📅 Período: Outubro/2024 (dias úteis)")

if __name__ == '__main__':
    main()
