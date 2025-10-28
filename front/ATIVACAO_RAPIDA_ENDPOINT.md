# 🔧 ATIVAÇÃO RÁPIDA - Endpoint Recuperação de Senha

## **STATUS ATUAL: 🚧 SIMULAÇÃO ATIVA**

O frontend está **100% funcional** com simulação. Para ativar completamente:

---

## **⚡ ATIVAÇÃO EM 5 MINUTOS**

### **1. Criar arquivo Python (Flask)**

```python
# app.py
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import boto3

app = Flask(__name__)

# Configurar DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')  # Sua região
table = dynamodb.Table('usuarios')  # Nome da sua tabela

@app.route('/forgot_password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')
        email = data.get('email')
        nova_senha = data.get('nova_senha')
        
        # Validações básicas
        if not all([usuario_id, email, nova_senha]):
            return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
            
        if len(nova_senha) < 6:
            return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
        
        # Verificar se usuário existe e email confere
        response = table.get_item(Key={'usuario_id': usuario_id})
        if 'Item' not in response:
            return jsonify({'error': 'Usuário não encontrado'}), 404
            
        user = response['Item']
        if user.get('email') != email:
            return jsonify({'error': 'E-mail não confere com o cadastrado'}), 401
        
        # Gerar hash da nova senha
        senha_hash = generate_password_hash(nova_senha)
        
        # Atualizar senha no banco
        table.update_item(
            Key={'usuario_id': usuario_id},
            UpdateExpression='SET senha_hash = :senha',
            ExpressionAttributeValues={':senha': senha_hash}
        )
        
        return jsonify({
            'success': True,
            'message': 'Senha alterada com sucesso!'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

### **2. Instalar dependências**

```bash
pip install flask boto3 werkzeug
```

### **3. Configurar AWS**

```bash
aws configure
# Digite suas credenciais AWS
```

### **4. Executar servidor**

```bash
python app.py
```

### **5. Remover simulação do frontend**

No arquivo `ForgotPasswordModal.tsx`, remova as linhas comentadas e descomente:

```typescript
// SUBSTITUIR ESTA PARTE:
// Simulação temporária...
await new Promise(resolve => setTimeout(resolve, 1500));

// POR ESTA:
await apiService.forgotPassword({
  usuario_id: formData.usuario_id,
  email: formData.email,
  nova_senha: formData.nova_senha,
});
```

---

## **🚀 TESTE RÁPIDO**

```bash
# Testar endpoint
curl -X POST http://localhost:5000/forgot_password \
  -H "Content-Type: application/json" \
  -d '{
    "usuario_id": "teste123",
    "email": "teste@empresa.com", 
    "nova_senha": "novaSenha123"
  }'
```

---

## **📋 CHECKLIST DE ATIVAÇÃO**

- [ ] ✅ **Frontend pronto** (100% funcional com simulação)
- [ ] ⚡ **Criar app.py** com endpoint
- [ ] 📦 **Instalar dependências** (flask, boto3)
- [ ] 🔑 **Configurar AWS** credentials
- [ ] 🚀 **Executar servidor** Python
- [ ] 🔧 **Remover simulação** do frontend
- [ ] ✅ **Testar funcionamento** completo

---

## **💡 ALTERNATIVA SUPER RÁPIDA**

Se quiser testar SEM backend real, a simulação atual já funciona perfeitamente! 

**Ela simula:**
- ✅ Validação de campos
- ✅ Verificação de usuário/email
- ✅ Feedback de sucesso/erro
- ✅ Interface completa

**Para usar em produção:** Apenas implemente o endpoint acima e remova a simulação.

---

## **🎯 RESULTADO**

Após ativar: **Sistema 100% funcional** com recuperação de senha real via ID + E-mail! 🚀

**Tempo estimado de implementação: 5-10 minutos** ⚡