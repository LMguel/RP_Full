#!/usr/bin/env python3
"""
Script para iniciar backend e frontend simultaneamente
"""
import subprocess
import sys
import os
import time
import threading
from pathlib import Path

def run_backend():
    """Executa o servidor Flask"""
    print("🚀 Iniciando Backend Flask...")
    try:
        # Certifica-se de estar no diretório correto
        backend_dir = Path(__file__).parent
        os.chdir(backend_dir)
        
        # Executa o Flask
        subprocess.run([sys.executable, "app.py"], check=True)
    except KeyboardInterrupt:
        print("\n⛔ Backend interrompido pelo usuário")
    except Exception as e:
        print(f"❌ Erro no backend: {e}")

def run_frontend():
    """Executa o servidor Vite do frontend"""
    print("🎨 Iniciando Frontend Vite...")
    try:
        # Navega para o diretório do frontend
        frontend_dir = Path(__file__).parent.parent / "front"
        os.chdir(frontend_dir)
        
        # Aguarda um pouco para o backend subir primeiro
        time.sleep(3)
        
        # Executa o Vite
        subprocess.run(["npm", "run", "dev"], check=True)
    except KeyboardInterrupt:
        print("\n⛔ Frontend interrompido pelo usuário")
    except Exception as e:
        print(f"❌ Erro no frontend: {e}")

def main():
    """Função principal que inicia ambos os serviços"""
    print("🚀 INICIANDO APLICAÇÃO COMPLETA")
    print("=" * 50)
    
    # Cria threads para executar backend e frontend simultaneamente
    backend_thread = threading.Thread(target=run_backend, daemon=True)
    frontend_thread = threading.Thread(target=run_frontend, daemon=True)
    
    try:
        # Inicia o backend primeiro
        backend_thread.start()
        
        # Inicia o frontend após uma pequena pausa
        frontend_thread.start()
        
        print("\n✅ Aplicação iniciada com sucesso!")
        print("🔗 Backend: http://localhost:5000")
        print("🎨 Frontend: http://localhost:5173")
        print("\n⚠️  Pressione Ctrl+C para parar ambos os serviços\n")
        
        # Mantém o script rodando
        backend_thread.join()
        frontend_thread.join()
        
    except KeyboardInterrupt:
        print("\n\n⛔ Encerrando aplicação...")
        print("👋 Até logo!")
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")

if __name__ == "__main__":
    main()