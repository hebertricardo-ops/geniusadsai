

## Plano: Campo WhatsApp no cadastro + webhook para Make.com

### O que será feito
1. Adicionar campo obrigatório "WhatsApp" (DDD + Número) no formulário de cadastro
2. Salvar o número na tabela `profiles`
3. Após cadastro bem-sucedido, enviar dados (nome, email, whatsapp) via webhook para o Make.com

### Alterações

**1. Migração de banco — adicionar coluna `whatsapp` na tabela `profiles`**
- `ALTER TABLE profiles ADD COLUMN whatsapp text;`

**2. Atualizar trigger `handle_new_user`**
- Salvar o campo `whatsapp` do `user_metadata` na coluna nova do profile

**3. Frontend — `src/pages/Auth.tsx`**
- Adicionar campo "WhatsApp" com placeholder "(11) 99999-9999", visível apenas no cadastro
- Máscara de formatação: `(DD) NNNNN-NNNN`
- Campo obrigatório no modo cadastro
- Validação: mínimo 10 dígitos numéricos

**4. Hook de auth — `src/hooks/useAuth.tsx`**
- Passar `whatsapp` no `user_metadata` do `signUp`

**5. Webhook para Make.com após cadastro**
- Após signup bem-sucedido (sem erro), disparar `fetch` POST para `https://hook.us2.make.com/1ifgxwj2g4o47qa1lbo3ab51vumvoydy`
- Body: `{ name, email, whatsapp }`
- Disparar de forma fire-and-forget (não bloqueia o fluxo do usuário)

### Sem edge function necessária
O webhook do Make.com é uma URL pública — pode ser chamado diretamente do frontend após o cadastro, sem necessidade de proxy via edge function.

