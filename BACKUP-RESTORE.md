# 📦 Backup e Restauração - tiZAP v1.1.0
 
 ## ✅ Tag Git Criada
 - **Versão:** v1.1.0
- **Data:** 22/01/2026
- **Repositório:** https://github.com/felcoslop/tizap

---

## 🔄 Como Restaurar Esta Versão

### 1. Restaurar Código
```bash
cd c:\Users\manu_\Downloads\app-village-att\ambev
git fetch --all --tags
git checkout v1.1.0
```

### 2. Reinstalar Dependências
```bash
npm install
npx prisma generate
```

### 3. Fazer Deploy
- Commit e push para main (se necessário)
- Easypanel vai fazer deploy automaticamente

---

## 💾 Backup do Banco de Dados (IMPORTANTE!)

### Criar Backup (no container do Easypanel):
```bash
cp /data/database.sqlite /data/database-backup-$(date +%Y%m%d).sqlite
```

### Restaurar Backup:
```bash
cp /data/database-backup-YYYYMMDD.sqlite /data/database.sqlite
```

### Download do Backup:
1. Easypanel → Files → `/data`
2. Baixar `database-backup-YYYYMMDD.sqlite`
3. Guardar em local seguro

---

## 🔐 Backup das Variáveis de Ambiente

**CRÍTICO:** Salve o conteúdo do `.env` em local seguro (NÃO commitar no Git!)

Variáveis importantes:
- `DATABASE_URL`
- `JWT_SECRET`
- `EMAIL_*` (configurações de email)
- `RESEND_API_KEY` (se usar)
- `GMAIL_REFRESH_TOKEN` (se usar)
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (se usar)

---

## 📋 Checklist de Backup Completo

- [x] Tag Git criada (`v1.1.0`)
- [ ] Backup do banco de dados baixado
- [ ] Cópia do `.env` salva em local seguro
- [ ] (Opcional) Snapshot do Easypanel criado

---

## 🚀 Funcionalidades da v1.1.0

### Principais Features:
- ✅ Disparo de WhatsApp (templates e fluxos)
- ✅ Flow Builder visual
- ✅ Campanhas de email
- ✅ Histórico de mensagens
- ✅ Webhook com tokens únicos
- ✅ Normalização de telefones
- ✅ Paginação (10 itens/página)
- ✅ Modais customizados
- ✅ Suporte múltiplas APIs de email

### Capacidade:
- 250-1000 leads/dia confortavelmente
- ~300-400 sessões simultâneas (1GB RAM)

### Correções Aplicadas (v1.1.0):
- ✅ Entrega de Áudio estável (MP3)
- ✅ Correção do erro de `audio/webm` no Chrome
- ✅ Normalização de telefones global
- ✅ Deleção de conversas e contatos fixa
- ✅ UI consistente e rápida
- ✅ Segurança: Ocultar Token e Gerador fixo
- ✅ Webhooks reordenados (Seguro)

---

## 📞 Suporte

Se precisar restaurar ou tiver problemas, use este documento como referência.

**Última atualização:** 22/01/2026
