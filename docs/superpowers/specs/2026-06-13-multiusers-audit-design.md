# Design: Multi-usuários + Auditoria por Empresa (Multi-Tenant)

**Data:** 2026-06-13  
**Status:** Aprovado  
**Escopo:** Backend (Flask/DynamoDB) + Frontend (React/MUI) — sem deploy

---

## 1. Objetivo

Permitir que cada empresa tenha múltiplos usuários com roles e permissões distintas, com trilha de auditoria completa de todas as alterações.

**Não quebra empresas existentes.** Usuários atuais são migrados automaticamente como OWNER.

---

## 2. Arquitetura

### Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Armazenamento de usuários | Estender `UserCompany` existente | Evita nova tabela, migração simples |
| Identificador de login | `usuario_id` textual (legado) | Backward-compat, sem reescrever login |
| Permissões | Role define padrão + override fino por OWNER | Flexível sem complexidade excessiva |
| Registros legados | Migrar `criado_por` com user_id do OWNER | Histórico completo sem gaps |

### Fluxo de autenticação

```
Login (usuario_id + senha)
  → Query UserCompany via GSI user_id-index
  → Verificar senha (bcrypt)
  → Calcular permissions = ROLE_DEFAULTS + overrides do campo permissions
  → Emitir JWT com {user_id, company_id, role, permissions, empresa_nome}
  → Log audit: action=LOGIN
```

---

## 3. DynamoDB

### Tabela `UserCompany` (estendida)

**Keys existentes:** `company_id` (HASH) + `user_id` (RANGE)

**Novo GSI:** `user_id-index`
- PK: `user_id`
- Projeção: ALL
- Finalidade: substituir o `scan` atual do login por `query` — O(n) → O(1)

**Campos adicionados nos itens:**

| Campo | Tipo | Valor padrão na migração |
|---|---|---|
| `role` | String | `"OWNER"` |
| `name` | String | `"Admin"` |
| `email` | String | vazio |
| `permissions` | Map | `{"add": [], "remove": []}` (delta sobre defaults do role) |
| `active` | Boolean | `true` |
| `last_login` | String | null |
| `created_by` | String | `"system"` |
| `created_at` | String | timestamp da migração |
| `updated_at` | String | timestamp da migração |
| `updated_by` | String | `"system"` |

### Nova tabela `AuditLogs`

```
PK: company_id (HASH)
SK: created_at#log_id  — ex: "2026-06-13T13:40:00#uuid4"
```

| Campo | Tipo |
|---|---|
| `log_id` | UUID4 String |
| `company_id` | String |
| `user_id` | String |
| `user_name` | String (denormalizado) |
| `entity` | `EMPLOYEE \| RECORD \| USER \| CONFIG \| RH` |
| `entity_id` | String |
| `action` | `CREATE \| EDIT \| DELETE \| ADJUST \| INVALIDATE \| LOGIN \| EXPORT \| CLOSE \| PERMISSION` |
| `before` | Map (nullable) |
| `after` | Map (nullable) |
| `ip` | String |
| `device` | String (User-Agent) |
| `created_at` | ISO String |

**GSI `user_id-index`:** PK = `user_id` — para filtrar logs por usuário.

---

## 4. Roles e Permissões

### Roles disponíveis

`OWNER | ADMIN | RH | MANAGER | VIEWER`

### Permissões disponíveis

```python
ALL_PERMISSIONS = [
    "dashboard", "funcionarios", "registros", "correcoes",
    "rh_folha", "configuracoes", "exportacoes", "ajustes",
    "excluir", "criar_usuario", "editar_usuario",
    "fechar_competencia", "reconhecimento", "admin_aws",
]
```

### Matriz de permissões padrão por role

| Permissão | OWNER | ADMIN | RH | MANAGER | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|
| dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| funcionarios | ✓ | ✓ | ✓ | ✓ | ✓ |
| registros | ✓ | ✓ | ✓ | ✓ | ✓ |
| correcoes | ✓ | ✓ | ✓ | ✓ | — |
| rh_folha | ✓ | ✓ | ✓ | — | — |
| configuracoes | ✓ | ✓ | — | — | — |
| exportacoes | ✓ | ✓ | ✓ | — | — |
| ajustes | ✓ | ✓ | ✓ | ✓ | — |
| excluir | ✓ | ✓ | — | — | — |
| criar_usuario | ✓ | — | — | — | — |
| editar_usuario | ✓ | ✓ | — | — | — |
| fechar_competencia | ✓ | ✓ | ✓ | — | — |
| reconhecimento | ✓ | ✓ | — | — | — |
| admin_aws | ✓ | — | — | — | — |

**Override:** O OWNER pode adicionar ou remover permissões individuais em qualquer usuário. O campo `permissions` na tabela armazena o **delta** em relação aos defaults do role: `{"add": ["admin_aws"], "remove": ["exportacoes"]}`.

**Implementação:** permissions no JWT = `ROLE_DEFAULTS[role] + permissions.add - permissions.remove` (calculado no login).

**Unicidade do OWNER:** Cada empresa tem exatamente um OWNER (o usuário original). O OWNER não pode ser excluído, desativado ou ter seu role alterado. Ao criar novos usuários, os roles disponíveis são: ADMIN, RH, MANAGER, VIEWER — não OWNER.

### Backward-compat

JWTs emitidos antes desta feature (sem campo `role`) são tratados como `OWNER` no backend:
```python
role = payload.get('role', 'OWNER')
```

---

## 5. Backend — Novos arquivos

### `backend/services/permissions.py`

```python
ROLE_DEFAULTS: dict[str, list[str]] = { ... }

def calculate_permissions(role: str, overrides: dict) -> list[str]:
    """Calcula lista final de permissões: defaults + add - remove."""
    ...

def check_permission(payload: dict, permission: str) -> bool:
    """Verifica se o payload JWT tem a permissão."""
    role = payload.get('role', 'OWNER')
    if role == 'OWNER':
        return True
    return permission in payload.get('permissions', [])
```

### `backend/utils/auth.py` (atualizado)

Adicionar decorator `require_permission(permission)`:
```python
def require_permission(permission: str):
    """Decorator aplicado após token_required. Verifica permissão específica."""
```

### `backend/services/audit_service.py`

```python
def log_event(
    company_id: str,
    user_id: str,
    user_name: str,
    entity: str,
    entity_id: str,
    action: str,
    before: dict | None,
    after: dict | None,
    request,  # Flask request para IP e User-Agent
) -> None:
    """Registra evento na tabela AuditLogs. Fire-and-forget (não bloqueia response)."""
```

### `backend/routes/users.py` (novo)

```
POST   /api/users                           criar_usuario
GET    /api/users                           — (qualquer autenticado)
PUT    /api/users/<user_id>                 editar_usuario
DELETE /api/users/<user_id>                 criar_usuario (hard/soft delete)
POST   /api/users/<user_id>/toggle-active   editar_usuario
```

### `backend/routes/audit.py` (novo)

```
GET /api/audit
  Params: user_id, action, entity, date_from, date_to, limit (default 100)
  Requer: qualquer autenticado (dados filtrados por company_id)
```

### `backend/migrations/migrate_users_roles.py`

Script executável uma vez:
1. Scan `UserCompany` → update_item adicionando `role=OWNER`, `name="Admin"`, `active=True`, `created_at`, `created_by="system"`
2. Scan `TimeRecords` → para cada item sem `criado_por`: update_item com `criado_por = user_id_do_owner_da_empresa`

### `backend/routes/api.py` (atualizado)

- Rota `/login`: após verificar senha, calcular permissões e incluir no JWT
- Rota `/login`: chamar `audit_service.log_event(..., action='LOGIN')`
- Rotas de CRUD de funcionários: popular `criado_por`, `atualizado_por` do payload
- Rota `/registros/<id>/invalidar`: popular `invalidado_por`, `invalidado_em` + log audit
- Rota de ajuste de registro: popular `ajustado_por`, `ajustado_em` + log audit

---

## 6. Frontend — Novos arquivos e mudanças

### `front/src/contexts/AuthContext.tsx` (atualizado)

Estado adicional:
```typescript
role: string | null;
permissions: string[];
userName: string | null;
hasPermission: (perm: string) => boolean;
```

`hasPermission` retorna `true` se `role === 'OWNER'` ou se a permissão está em `permissions[]`.

### `front/src/components/PermissionGuard.tsx` (novo)

```tsx
<PermissionGuard permission="configuracoes" fallback={<Navigate to="/dashboard" />}>
  <SettingsPage />
</PermissionGuard>
```

Oculta/redireciona silenciosamente. Nunca desabilita — remove da UI.

### `front/src/pages/SettingsPage.tsx` (atualizado)

Nova aba "Usuários" (somente visível com permissão `criar_usuario` ou `editar_usuario`):
- Tabela: Nome, ID login, Role badge colorido, Status chip, Último login, Ações
- Botão "+ Adicionar" (somente `criar_usuario`)
- Drawer lateral: campos Nome, ID login, Senha (somente criação), Role select, Permissões fine-grained (toggles)
- Não pode editar ou desativar o próprio usuário logado

### `front/src/pages/AuditPage.tsx` (novo, rota `/auditoria`)

- Requer permissão `configuracoes` para acessar
- Filtros: Usuário (select), Data de/até, Ação (select), Entidade (select)
- Tabela: Data/Hora, Usuário, Entidade, Ação, Descrição (gerada no frontend)
- Linha expandível: mostra diff ANTES/DEPOIS lado a lado

### `front/src/pages/EmployeeRecordsPage.tsx` (atualizado)

Nova aba "Timeline" no detalhe do funcionário:
- Lista cronológica de eventos do `AuditLogs` filtrando `entity_id = funcionario_id`
- Eventos: Criado, Editado, Foto alterada, Registro ajustado, etc.
- Cada item: data + usuário responsável + o que mudou

### `front/src/components/Layout.tsx` (atualizado)

Menu lateral: itens condicionados a `hasPermission(perm)`.
Novo item "Auditoria" com ícone `HistoryEdu` → `/auditoria`.

### `front/src/services/api.ts` (atualizado)

```typescript
// Usuários
getUsers(): Promise<...>
createUser(data): Promise<...>
updateUser(userId, data): Promise<...>
deleteUser(userId): Promise<...>
toggleUserActive(userId): Promise<...>

// Auditoria
getAuditLogs(filters): Promise<...>
```

### `front/src/types/index.ts` (atualizado)

```typescript
export type UserRole = 'OWNER' | 'ADMIN' | 'RH' | 'MANAGER' | 'VIEWER';

export interface CompanyUser {
  user_id: string;
  company_id: string;
  name: string;
  email?: string;
  role: UserRole;
  permissions: Record<string, boolean>;
  active: boolean;
  last_login?: string;
  created_at: string;
  created_by: string;
}

export interface AuditLog {
  log_id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  entity: 'EMPLOYEE' | 'RECORD' | 'USER' | 'CONFIG' | 'RH';
  entity_id: string;
  action: 'CREATE' | 'EDIT' | 'DELETE' | 'ADJUST' | 'INVALIDATE' | 'LOGIN' | 'EXPORT' | 'CLOSE' | 'PERMISSION';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  device?: string;
  created_at: string;
}
```

---

## 7. Segurança

- **Backend sempre valida** `company_id` do JWT — nenhuma rota aceita `company_id` do body
- Usuários só veem/editam usuários do mesmo `company_id`
- OWNER não pode ser excluído, desativado ou ter seu role alterado (guard no backend)
- Ao criar usuários, os roles disponíveis são ADMIN, RH, MANAGER, VIEWER — nunca OWNER
- Não é possível alterar o próprio role
- Rotas de auditoria filtram sempre por `company_id` — Empresa A nunca vê logs da Empresa B
- `require_permission` é aplicado no backend — frontend oculta mas nunca é a única barreira

---

## 8. Eventos auditados

| Módulo | Eventos |
|---|---|
| Funcionários | CREATE, EDIT, DELETE |
| Registros de ponto | CREATE, ADJUST, INVALIDATE |
| RH/Folha | CLOSE (fechamento de competência), EXPORT |
| Usuários | LOGIN, CREATE, EDIT, PERMISSION (change) |
| Configurações | EDIT |

---

## 9. Compatibilidade

- Reconhecimento facial, kiosk, tablet, mobile, sync: **nenhuma alteração**
- JWT antigo (sem `role`/`permissions`): tratado como OWNER no backend
- `UserCompany` existente: extensão aditiva — nenhum campo removido
- O campo `tipo: "empresa"` no JWT é mantido

---

## 10. Cenários de teste

1. **Isolamento multi-tenant:** Empresa A não vê usuários/logs da Empresa B
2. **Role VIEWER:** Acessa Dashboard, Funcionários, Registros — não vê menu Configurações
3. **Role RH:** Vê RH/Folha, não consegue acessar `/api/users` (403)
4. **OWNER cria usuário:** Aparece na lista, recebe role correto
5. **Auditoria:** Editar funcionário gera log com before/after; filtrar por usuário funciona
6. **JWT legado:** Token sem `role` é aceito com acesso total (OWNER)
7. **Migração:** Todos os items `UserCompany` têm `role=OWNER` após rodar script

---

## 11. Arquivos afetados

### Novos
- `backend/services/permissions.py`
- `backend/services/audit_service.py`
- `backend/routes/users.py`
- `backend/routes/audit.py`
- `backend/migrations/migrate_users_roles.py`
- `front/src/components/PermissionGuard.tsx`
- `front/src/pages/AuditPage.tsx`

### Modificados
- `backend/utils/auth.py` — decorator `require_permission`
- `backend/routes/api.py` — login JWT, criado_por/ajustado_por/invalidado_por nos registros
- `backend/routes/__init__.py` — registrar blueprints
- `backend/utils/aws.py` — constante `DYNAMODB_TABLE_AUDIT`
- `front/src/contexts/AuthContext.tsx` — role, permissions, hasPermission
- `front/src/components/Layout.tsx` — guards de menu
- `front/src/pages/SettingsPage.tsx` — aba Usuários
- `front/src/pages/EmployeeRecordsPage.tsx` — aba Timeline
- `front/src/services/api.ts` — endpoints users + audit
- `front/src/types/index.ts` — CompanyUser, AuditLog, UserRole
- `front/src/App.tsx` — rota /auditoria
