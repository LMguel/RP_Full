"""
TESTE FINAL - Verificar se o endpoint está funcionando
"""
from datetime import date
from summary_calculator import calculate_daily_summary

COMPANY_ID = '937373ab-6d74-4a67-a580-7c57c5e608e4'
EMPLOYEE_ID = 'luis_miguel_aa7c29'
TODAY = date(2025, 11, 15)

print("="*70)
print("  TESTE FINAL - CÁLCULO DE SUMÁRIO")
print("="*70)
print(f"Company ID: {COMPANY_ID}")
print(f"Employee ID: {EMPLOYEE_ID}")
print(f"Data: {TODAY}")

print("\nCalculando sumário...")
try:
    summary = calculate_daily_summary(COMPANY_ID, EMPLOYEE_ID, TODAY)
    
    if summary:
        print("\n✅ SUCESSO! Sumário calculado:")
        print(f"   - Data: {summary.date}")
        print(f"   - Entrada (actual_start): {summary.actual_start}")
        print(f"   - Saída (actual_end): {summary.actual_end}")
        print(f"   - Horas Trabalhadas: {float(summary.worked_hours):.2f}h")
        print(f"   - Horas Previstas: {float(summary.expected_hours):.2f}h")
        print(f"   - Balanço: {float(summary.daily_balance):.2f}h")
        print(f"   - Status: {summary.status}")
        print(f"   - Total de registros: {summary.records_count}")
        
        print("\n" + "="*70)
        print("  CONCLUSÃO")
        print("="*70)
        print("✅ O cálculo está funcionando!")
        print("✅ O endpoint /api/registros-diarios deve exibir os dados")
        print("\n💡 Se não aparecer na tela:")
        print("   1. Verifique o token JWT")
        print("   2. Verifique o filtro de mês (deve ser 2025-11)")
        print("   3. Abra o console do navegador e veja os logs")
    else:
        print("\n❌ Sumário retornou None")
        print("   Possíveis causas:")
        print("   - Funcionário marcado como ausente")
        print("   - Sem registros para o dia")
except Exception as e:
    print(f"\n❌ ERRO ao calcular sumário:")
    print(f"   {e}")
    import traceback
    traceback.print_exc()
