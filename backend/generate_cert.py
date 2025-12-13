#!/usr/bin/env python3
"""
Gera certificado SSL auto-assinado para desenvolvimento
"""
from OpenSSL import crypto
import os

def generate_self_signed_cert(cert_file='cert.pem', key_file='key.pem'):
    """Gera certificado SSL auto-assinado"""
    
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
    cert.get_subject().CN = "192.168.1.5"
    
    # Adicionar Subject Alternative Names (SANs)
    cert.add_extensions([
        crypto.X509Extension(
            b"subjectAltName",
            False,
            b"DNS:localhost,DNS:127.0.0.1,IP:192.168.1.5"
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
    # Verifica se os arquivos já existem
    if os.path.exists('cert.pem') and os.path.exists('key.pem'):
        response = input("Certificados já existem. Sobrescrever? (s/n): ")
        if response.lower() != 's':
            print("❌ Operação cancelada")
            exit(0)
    
    generate_self_signed_cert()
