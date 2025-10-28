# 🔧 Implementação Backend - Reset de Senha

## **Endpoints Necessários no Backend**

### **1. POST /forgot_password (Auto-atendimento)**

```python
# Python/Flask Example
from werkzeug.security import generate_password_hash
import boto3

@app.route('/forgot_password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')
        email = data.get('email')
        nova_senha = data.get('nova_senha')
        
        # Validações
        if not usuario_id or not email or not nova_senha:
            return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
            
        if len(nova_senha) < 6:
            return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
        
        # Conectar ao DynamoDB
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('usuarios')  # Substitua pelo nome da sua tabela
        
        # Verificar se usuário existe e email confere
        response = table.get_item(Key={'usuario_id': usuario_id})
        if 'Item' not in response:
            return jsonify({'error': 'Usuário não encontrado'}), 404
            
        user = response['Item']
        if user.get('email') != email:
            return jsonify({'error': 'E-mail não confere com o cadastrado'}), 401
        
        # Gerar hash da nova senha
        senha_hash = generate_password_hash(nova_senha)
        
        # Atualizar senha
        table.update_item(
            Key={'usuario_id': usuario_id},
            UpdateExpression='SET senha_hash = :senha',
            ExpressionAttributeValues={':senha': senha_hash}
        )
        
        return jsonify({
            'success': True,
            'message': f'Senha alterada com sucesso para {usuario_id}'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### **Node.js/Express Example**

```javascript
const bcrypt = require('bcrypt');
const AWS = require('aws-sdk');

app.post('/forgot_password', async (req, res) => {
    try {
        const { usuario_id, email, nova_senha } = req.body;
        
        // Validações
        if (!usuario_id || !email || !nova_senha) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }
        
        if (nova_senha.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
        }
        
        // Configurar DynamoDB
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const tableName = 'usuarios'; // Substitua pelo nome da sua tabela
        
        // Verificar se usuário existe e email confere
        const getParams = {
            TableName: tableName,
            Key: { usuario_id }
        };
        
        const user = await dynamodb.get(getParams).promise();
        if (!user.Item) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        if (user.Item.email !== email) {
            return res.status(401).json({ error: 'E-mail não confere com o cadastrado' });
        }
        
        // Gerar hash da nova senha
        const saltRounds = 10;
        const senha_hash = await bcrypt.hash(nova_senha, saltRounds);
        
        // Atualizar senha
        const updateParams = {
            TableName: tableName,
            Key: { usuario_id },
            UpdateExpression: 'SET senha_hash = :senha',
            ExpressionAttributeValues: {
                ':senha': senha_hash
            }
        };
        
        await dynamodb.update(updateParams).promise();
        
        res.json({
            success: true,
            message: `Senha alterada com sucesso para ${usuario_id}`
        });
        
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
```

### **2. POST /reset_password (Administradores)**

```python
# Python/Flask Example
from werkzeug.security import generate_password_hash
import boto3

@app.route('/reset_password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')
        nova_senha = data.get('nova_senha')
        
        # Validações
        if not usuario_id or not nova_senha:
            return jsonify({'error': 'Dados obrigatórios ausentes'}), 400
            
        if len(nova_senha) < 6:
            return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
        
        # Gerar hash da nova senha
        senha_hash = generate_password_hash(nova_senha)
        
        # Atualizar no banco de dados AWS
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('usuarios')  # Substitua pelo nome da sua tabela
        
        # Verificar se usuário existe
        response = table.get_item(Key={'usuario_id': usuario_id})
        if 'Item' not in response:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Atualizar senha
        table.update_item(
            Key={'usuario_id': usuario_id},
            UpdateExpression='SET senha_hash = :senha',
            ExpressionAttributeValues={':senha': senha_hash}
        )
        
        return jsonify({
            'success': True,
            'message': f'Senha redefinida para o usuário {usuario_id}'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

---

## **🚀 Implementação Rápida - Endpoints Simples**

### **Flask Completo (app.py)**

```python
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash
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
        
        if not all([usuario_id, email, nova_senha]):
            return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
            
        if len(nova_senha) < 6:
            return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
        
        # Verificar usuário e email
        response = table.get_item(Key={'usuario_id': usuario_id})
        if 'Item' not in response:
            return jsonify({'error': 'Usuário não encontrado'}), 404
            
        if response['Item'].get('email') != email:
            return jsonify({'error': 'E-mail não confere com o cadastrado'}), 401
        
        # Atualizar senha
        senha_hash = generate_password_hash(nova_senha)
        table.update_item(
            Key={'usuario_id': usuario_id},
            UpdateExpression='SET senha_hash = :senha',
            ExpressionAttributeValues={':senha': senha_hash}
        )
        
        return jsonify({'success': True, 'message': 'Senha alterada com sucesso!'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reset_password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')
        nova_senha = data.get('nova_senha')
        
        if not all([usuario_id, nova_senha]):
            return jsonify({'error': 'Dados obrigatórios ausentes'}), 400
            
        if len(nova_senha) < 6:
            return jsonify({'error': 'Senha deve ter pelo menos 6 caracteres'}), 400
        
        # Verificar se usuário existe
        response = table.get_item(Key={'usuario_id': usuario_id})
        if 'Item' not in response:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Atualizar senha
        senha_hash = generate_password_hash(nova_senha)
        table.update_item(
            Key={'usuario_id': usuario_id},
            UpdateExpression='SET senha_hash = :senha',
            ExpressionAttributeValues={':senha': senha_hash}
        )
        
        return jsonify({'success': True, 'message': f'Senha redefinida para {usuario_id}'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
```

---

## **📋 Como Implementar**

### **1. Instalar Dependências**

```bash
# Python
pip install flask boto3 werkzeug

# Node.js
npm install express bcrypt aws-sdk
```

### **2. Configurar AWS**

```bash
# Configure suas credenciais AWS
aws configure
```

### **3. Testar Endpoints**

```bash
# Teste forgot_password
curl -X POST http://localhost:5000/forgot_password \
  -H "Content-Type: application/json" \
  -d '{
    "usuario_id": "usuario123",
    "email": "usuario@empresa.com",
    "nova_senha": "novaSenha123"
  }'

# Teste reset_password
curl -X POST http://localhost:5000/reset_password \
  -H "Content-Type: application/json" \
  -d '{
    "usuario_id": "usuario123",
    "nova_senha": "senhaAdmin123"
  }'
```

---

## **🎯 Estrutura da Tabela DynamoDB**

```json
{
  "usuario_id": "string (Partition Key)",
  "email": "string",
  "senha_hash": "string",
  "empresa_nome": "string",
  "empresa_id": "string"
}
```

---

## **✅ Validações Implementadas**

- ✅ **Campos obrigatórios** verificados
- ✅ **Usuário existe** no banco
- ✅ **E-mail confere** com cadastro
- ✅ **Senha mínima** 6 caracteres
- ✅ **Hash seguro** da senha
- ✅ **Tratamento de erros** completo

**O frontend já está pronto! Só implementar um desses endpoints no backend.** 🚀