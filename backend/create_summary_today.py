"""
Criar resumo diário usando o serviço de summaries
"""
import sys
sys.path.insert(0, 'C:\\RP_\\REGISTRA.PONTO\\backend')

from services.summaries import recalc_daily_summary
from datetime import date

# Criar resumo para hoje
hoje = date.today()
print(f"📅 Recalculando resumo para hoje: {hoje}")

try:
    result = recalc_daily_summary(
        company_id="937373ab-6d74-4a67-a580-7c57c5e608e4",
        employee_id="aaa",
        target_date=hoje
    )
    print("✅ Resumo criado!")
    print(f"  - Status: {result.get('status')}")
    print(f"  - Trabalhadas: {result.get('worked_hours', 0) / 60:.1f}h")
    print(f"  - Esperadas: {result.get('expected_hours', 0) / 60:.1f}h")
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()
