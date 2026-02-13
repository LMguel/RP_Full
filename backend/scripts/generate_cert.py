#!/usr/bin/env python3
"""
Gera certificado SSL auto-assinado para desenvolvimento
"""
from OpenSSL import crypto
import os

def generate_self_signed_cert(cert_file='cert.pem', key_file='key.pem', 
                                server_ip=None, server_domain=None):
    """Gera certificado SSL auto-assinado
    
    Args:
        cert_file: Nome do arquivo de certificado
        key_file: Nome do arquivo de chave privada
        server_ip: IP do servidor (opcional, usa variável de ambiente ou padrão)
        server_domain: Domínio do servidor (opcional, usa variável de ambiente ou padrão)
    """
    import os
    
    # Obter configurações de variáveis de ambiente ou usar padrões
    server_ip = server_ip or os.getenv('SERVER_IP', '127.0.0.1')
    server_domain = server_domain or os.getenv('SERVER_DOMAIN', 'localhost')
    
    # Criar par de chaves
    k = crypto.PKey()
    k.generate_key(crypto.TYPE_RSA, 2048)
    
    # Criar certificado
    cert = crypto.X509()
    cert.get_subject().C = "BR"
    cert.get_subject().ST = "Estado"
    cert.get_subject().L = "Cidade"
    cert.get_subject().O = "RP_Full"
    cert.get_subject().OU = "Development"
    cert.get_subject().CN = server_domain
    
    # Adicionar Subject Alternative Names (SANs)
    sans = f"DNS:{server_domain},DNS:localhost,DNS:127.0.0.1,IP:{server_ip}"
    cert.add_extensions([
        crypto.X509Extension(
            b"subjectAltName",
            False,
            sans.encode('utf-8')
        ),
    ])
    
    cert.set_serial_number(1000)
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(365*24*60*60)  # Válido por 1 ano
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(k)
    cert.sign(k, 'sha256')
    
    # Salvar certificado
    with open(cert_file, "wb") as f:
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))
    
    # Salvar chave privada
    with open(key_file, "wb") as f:
        f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, k))
    
    print(f"✅ Certificado gerado: {cert_file}")
    print(f"✅ Chave privada gerada: {key_file}")
    print("\n⚠️  AVISO: Este é um certificado auto-assinado para desenvolvimento!")
    print("   O navegador mostrará um aviso de segurança - isso é normal.")

if __name__ == "__main__":
    import sys
    
    # Verifica se os arquivos já existem
    if os.path.exists('cert.pem') and os.path.exists('key.pem'):
        response = input("Certificados já existem. Sobrescrever? (s/n): ")
        if response.lower() != 's':
            print("❌ Operação cancelada")
            exit(0)
    
    # Permite passar IP e domínio como argumentos
    server_ip = sys.argv[1] if len(sys.argv) > 1 else None
    server_domain = sys.argv[2] if len(sys.argv) > 2 else None
    
    generate_self_signed_cert(server_ip=server_ip, server_domain=server_domain)
