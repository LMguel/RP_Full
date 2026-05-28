# LGPD.md — RegistraPonto

## Base legal para tratamento de dados

| Dado | Base Legal | Referência |
|------|-----------|-----------|
| Foto facial (biométrico) | Execução de contrato + Consentimento | Art. 7, V + Art. 11, II |
| Registros de ponto | Obrigação legal (CLT Art. 74) | Art. 7, II |
| CPF, nome, cargo | Execução de contrato | Art. 7, V |
| Localização GPS | Consentimento / legítimo interesse | Art. 7, IX |

## Dados tratados e sua localização

| Dado | Armazenamento | Criptografia | Retenção |
|------|--------------|--------------|---------|
| Foto facial | AWS S3 (`company_id/funcionarios/`) | AES-256 em repouso (S3 SSE) | Até exclusão do funcionário |
| face_id Rekognition | DynamoDB `Employees` + Rekognition Collection | Não exposto ao frontend | Até exclusão do funcionário |
| Registros de ponto | DynamoDB `TimeRecords` | AES-256 em repouso | Mínimo 5 anos (CLT) |
| CPF | DynamoDB `Employees` | AES-256 em repouso | Até exclusão + 5 anos |
| Cache offline (tablet) | IndexedDB — apenas id, nome, cargo, matrícula | **Não criptografado** | Até logout/troca de empresa |

## Direitos do titular (LGPD Art. 18)

### Acesso (Art. 18, I)
- Funcionários podem ver seus registros via `/funcionario/espelho`
- Exportação manual disponível via espelho de ponto

### Correção (Art. 18, III)
- Empresa pode invalidar e corrigir registros via portal

### Eliminação (Art. 18, VI)
- Endpoint: `DELETE /api/funcionarios/{id}` (soft-delete)
- Remove: foto, login, senha_hash, face_id do Rekognition
- **Mantém**: registros históricos de ponto (obrigação CLT)
- **Prazo**: Executar imediatamente a pedido

### Portabilidade (Art. 18, V)
- Exportação via espelho de ponto (PDF/CSV)
- **Pendente**: endpoint de exportação completa de dados

## Checklist LGPD — operação

- [ ] Termo de consentimento assinado para uso de biometria (Art. 11)
- [ ] Política de privacidade publicada no site
- [ ] DPO (Encarregado) indicado ou justificativa de dispensa
- [ ] Registro de atividades de tratamento (Art. 37)
- [ ] Relatório de impacto (RIPD) para biometria (Art. 38)
- [ ] Processo documentado para exercício de direitos (72h máximo)
- [ ] Contrato com AWS DPA (Data Processing Addendum)
- [ ] Contrato com GROQ DPA (chatbot RH processa dados de funcionários)

## Incidente de vazamento

Em caso de incidente envolvendo dados pessoais:

1. **Contenção imediata** (< 1h): Identificar escopo, revogar acessos comprometidos
2. **Avaliação** (< 24h): Volume de registros afetados, categorias de dados, risco aos titulares
3. **Notificação ANPD** (< 72h): Via portal gov.br/anpd se houver risco relevante
4. **Notificação titulares**: Se houver risco alto, notificar diretamente
5. **Documentação**: Registrar data, escopo, medidas tomadas

## Retenção e eliminação

| Categoria | Prazo de retenção | Procedimento |
|-----------|------------------|-------------|
| Registros de ponto | 5 anos (CLT Art. 74) | Arquivar, não deletar |
| Fotos biométricas | Até desligamento + 30 dias | Soft-delete remove S3 key |
| Dados pessoais (CPF, nome) | Até desligamento + 5 anos | Anonimizar após 5 anos |
| Logs de acesso | 1 ano | CloudWatch retention policy |
| Cache offline (tablet) | Até logout | Limpo automaticamente no signOut |

## Aviso de risco atual (pendente correção)

- **Cache offline não criptografado**: IndexedDB armazena nome/cargo/matrícula no tablet sem criptografia.
  - Risco: Acesso físico ao tablet expõe lista de funcionários ativos
  - Mitigação parcial: Apenas campos mínimos são armazenados (sem biometria)
  - Solução: Implementar Web Crypto API para criptografar IndexedDB
