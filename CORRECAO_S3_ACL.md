# 🔧 CORREÇÃO: S3 Bucket Policy - Acesso Público sem ACLs

## ❌ ERRO CORRIGIDO
```
AccessControlListNotSupported: The bucket does not allow ACLs
```

## ✅ SOLUÇÃO IMPLEMENTADA

### Código Atualizado
Removidos todos os `ACL='public-read'` dos uploads S3 em:
- ✅ `backend/s3_manager.py` (linha 46)
- ✅ `backend/aws_utils.py` (linha 56)

### Como o S3 Funciona Agora

O bucket `registraponto-prod-fotos` está configurado com:
- **Object Ownership:** `BucketOwnerEnforced` (recomendado pela AWS)
- **ACLs desabilitados** (melhor prática de segurança)
- **Acesso público via Bucket Policy** (ao invés de ACLs individuais)

---

## 🔐 CONFIGURAÇÃO DO BUCKET S3

### Opção 1: Bucket Totalmente Público (Mais Simples)

Se você quer que **todas as fotos sejam acessíveis publicamente**:

1. Acesse o AWS Console → S3 → `registraponto-prod-fotos`

2. Vá em **Permissions** → **Block public access**
   - Desabilite "Block all public access"
   - Confirme a ação

3. Vá em **Permissions** → **Bucket policy**
   - Adicione esta política:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::registraponto-prod-fotos/*"
        }
    ]
}
```

4. Salve

✅ **Pronto!** Todas as fotos agora serão acessíveis via URL pública.

---

### Opção 2: Acesso Apenas com URLs Assinadas (Mais Seguro)

Se você quer **controlar quem acessa as fotos**:

1. **Mantenha o bucket privado** (não desabilite "Block public access")

2. **Modifique o código para gerar URLs assinadas temporárias**:

#### Atualizar `s3_manager.py`:
```python
def get_photo_url(s3_key: str, expiration: int = 3600) -> str:
    """
    Gera URL assinada temporária (válida por 1 hora por padrão)
    
    Args:
        s3_key: Chave do objeto no S3
        expiration: Tempo de expiração em segundos (padrão: 3600 = 1h)
        
    Returns:
        URL assinada temporária
    """
    try:
        url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET,
                'Key': s3_key
            },
            ExpiresIn=expiration
        )
        return url
    except Exception as e:
        print(f"[S3] Erro ao gerar URL assinada: {e}")
        # Fallback para URL pública (caso bucket seja público)
        return f"https://{BUCKET}.s3.amazonaws.com/{s3_key}"
```

#### Atualizar `upload_photo_to_s3()`:
```python
def upload_photo_to_s3(company_id, employee_id, photo_bytes, timestamp=None, content_type='image/jpeg'):
    s3_key = generate_s3_key(company_id, employee_id, timestamp)
    
    try:
        s3.put_object(
            Bucket=BUCKET,
            Key=s3_key,
            Body=photo_bytes,
            ContentType=content_type
            # Sem ACL - bucket privado
        )
        
        # Gerar URL assinada temporária (válida por 7 dias)
        url = get_photo_url(s3_key, expiration=604800)  # 7 dias
        
        print(f"[S3] Upload concluído: {s3_key}")
        print(f"[S3] URL assinada gerada (válida por 7 dias)")
        
        return s3_key, url
        
    except Exception as e:
        print(f"[S3] Erro ao fazer upload: {e}")
        raise
```

---

## 🧪 TESTAR A CORREÇÃO

### 1. Reiniciar o Flask
```bash
cd backend
python app.py
```

### 2. Testar Cadastro de Funcionário

**No Frontend Web:**
1. Acesse a página de cadastro de funcionários
2. Preencha os dados e envie uma foto
3. Verifique se o cadastro é concluído sem erro
4. Tente acessar a foto do funcionário cadastrado

**Via API direta:**
```bash
curl -X POST http://localhost:5000/api/cadastrar_funcionario \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "nome=Teste Usuario" \
  -F "email=teste@email.com" \
  -F "senha=senha123" \
  -F "foto=@/caminho/para/foto.jpg"
```

### 3. Verificar Logs

Deve aparecer:
```
[S3] Upload concluído: 937373ab-6d74-4a67-a580-7c57c5e608e4/funcionarios/teste_usuario_abc123.jpg
[S3] URL: https://registraponto-prod-fotos.s3.amazonaws.com/937373ab-.../teste_usuario_abc123.jpg
```

**Sem o erro:**
```
✅ Não deve mais aparecer: AccessControlListNotSupported
```

---

## 📊 VERIFICAR BUCKET POLICY ATUAL

### Via AWS CLI:
```bash
aws s3api get-bucket-policy --bucket registraponto-prod-fotos
```

### Via AWS Console:
1. S3 → `registraponto-prod-fotos`
2. **Permissions** → **Bucket policy**
3. Verificar se existe política de acesso público

---

## 🔍 DIAGNÓSTICO DE PROBLEMAS

### Erro: "403 Forbidden" ao acessar foto
**Causa:** Bucket não tem política de acesso público  
**Solução:** Aplicar Opção 1 (Bucket Policy) ou Opção 2 (URLs assinadas)

### Erro: "AccessDenied" no upload
**Causa:** Credenciais AWS não têm permissão `s3:PutObject`  
**Solução:** Verificar IAM policy do usuário/role

### Erro: "NoSuchBucket"
**Causa:** Nome do bucket incorreto em `.env`  
**Solução:** Verificar `S3_BUCKET_NAME` em `backend/.env`

---

## ✅ ARQUIVOS MODIFICADOS

1. **`backend/s3_manager.py`**
   - Linha 46: Removido `ACL='public-read'`
   - Adicionado comentário explicativo

2. **`backend/aws_utils.py`**
   - Linha 56: Removido `'ACL': 'public-read'` do ExtraArgs
   - Mantido apenas `'ContentType': 'image/jpeg'`

---

## 🚀 RECOMENDAÇÃO

Para **produção**, use a **Opção 2 (URLs assinadas)**:
- ✅ Mais seguro
- ✅ Controle de acesso
- ✅ Links expiram automaticamente
- ✅ Não precisa de bucket público

Para **desenvolvimento/teste**, use a **Opção 1 (Bucket público)**:
- ✅ Mais simples
- ✅ URLs permanentes
- ✅ Fácil de debugar

---

## 📝 CHECKLIST

- [x] Código atualizado (ACLs removidos)
- [ ] Bucket S3 configurado com política de acesso
- [ ] Flask reiniciado
- [ ] Cadastro de funcionário testado
- [ ] Foto acessível via URL
- [ ] Sem erros nos logs

---

**Correção aplicada em:** 13 de Novembro de 2025  
**Status:** ✅ Código corrigido - Aguardando configuração do bucket
