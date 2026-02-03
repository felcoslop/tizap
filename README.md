# tiZAP! - Plataforma SaaS de Automação de Marketing e Atendimento Omnichannel

Este projeto é uma solução robusta de Software as a Service (SaaS) projetada para centralizar e automatizar o atendimento ao cliente e campanhas de marketing através de múltiplos canais, com foco principal em WhatsApp e E-mail. A plataforma oferece um construtor de fluxos visual (Canvas), automação baseada em palavras-chave e disparos em massa.

---

## 1. Visão Geral do Sistema

O tiZAP! permite que empresas gerenciem sua comunicação de forma escalável. Suas principais capacidades incluem:

- **Canvas de Fluxo (Chatbot):** Interface visual para criação de fluxos de conversação inteligentes com suporte a mensagens de texto, imagens, opções interativas e controle de horário comercial.
- **Disparo de Mensagens em Massa:** Sistema para envio de campanhas (Broadcast) para listas de leads via WhatsApp e E-mail.
- **Integração Omnichannel:** Suporte nativo à API Oficial da Meta e APIs alternativas (Evolution API) para máxima flexibilidade.
- **Gestão de Leads e Histórico:** Armazenamento centralizado de conversas, logs de execução de fluxos e status de entrega.
- **Sistema de Assinaturas:** Controle de acesso baseado em planos (Free/Paid) com integração de pagamentos.

---

## 2. Arquitetura Tecnológica

### Frontend
- **Framework:** Vite + React (v19+).
- **Gerenciamento de Fluxos:** `React Flow` para a renderização e manipulação do Canvas.
- **UI/Arquitetura:** Tailwind CSS para estilização, Lucide React para iconografia e Framer Motion para animações de interface.
- **Comunicação:** Axios para requisições REST e WebSocket (`ws`) para atualizações em tempo real (ex: progresso de disparos).

### Backend
- **Runtime:** Node.js (Ambiente ES Modules).
- **Framework Web:** Express.js (v5+).
- **Persistência:** SQLite (via Prisma ORM) para armazenamento leve e eficiente.
- **Real-time:** Integração nativa com WebSocket para comunicação bidirecional com o frontend.

### Banco de Dados (Prisma Schema)
Modelos principais definidos em `prisma/schema.prisma`:
- `User`: Cadastro de usuários, preferências e status de assinatura.
- `UserConfig`: Configurações técnicas (Tokens API, IDs de telefone, Horário Comercial).
- `Flow` / `Automation`: Definições JSON dos nós e arestas do construtor de fluxos.
- `FlowSession`: Estado atual de um contato dentro de um fluxo (passo atual, variáveis).
- `ReceivedMessage` / `EvolutionMessage`: Logs históricos de mensagens enviadas e recebidas.
- `Dispatch`: Controle de campanhas de disparo em massa.

---

## 3. Detalhamento de Módulos (Core Business)

### Engine de WhatsApp
O sistema opera com uma abordagem híbrida de integração:
- **Meta API (Oficial):** Utilizada para disparos baseados em templates aprovados e mensagens interativas oficiais. Implementada em `server/services/whatsapp.js`.
- **Evolution API:** Utilizada como ponte para instâncias de WhatsApp (Baseada em Baileys), permitindo maior flexibilidade em gatilhos de entrada e mensagens de texto simples. A lógica de Webhooks e processamento está em `server/routes/evolution.js`.
- **Baileys:** Utilizada internamente para tarefas de apoio, como download de mídia e manipulação de mensagens complexas.

### Flow Builder (Canvas)
Implementado primordialmente em `src/views/Dashboard/FlowBuilder.jsx` e `AutomationBuilder.jsx`:
- **Estruturação:** O fluxo é salvo como dois objetos JSON (`nodes` e `edges`) que seguem o padrão da biblioteca `React Flow`.
- **Nós:** Cada nó possui atributos como `typingTime` (atraso de resposta), `label` e dados específicos do tipo (ex: URLs de imagem para nó de Imagem, horários para nó de Business Hours).
- **Execução:** O `FlowEngine.js` reside no servidor e interpreta esses objetos JSON em tempo real conforme as mensagens chegam, gerenciando a transição de estados (`FlowSession`).

### Disparador de E-mails
- **Engine:** Utiliza `nodemailer` para o transporte de mensagens.
- **Lógica:** Localizada em `server/services/emailEngine.js`. Suporta templates HTML personalizados e variáveis dinâmicas baseadas nos dados dos leads.
- **Fila:** O progresso é monitorado via `dispatchEngine.js`, enviando atualizações de status via WebSocket para o Dashboard do usuário.

---

## 4. Guia de Instalação e Execução

### Pré-requisitos
- Node.js v18 ou superior.
- NPM ou Yarn.
- Docker (opcional, para deploy).

### Setup Local
1.  **Instalação:**
    ```bash
    cd ambev
    npm install
    ```
2.  **Configuração:** Crie um arquivo `.env` na raiz da pasta `ambev` seguindo o modelo:
    ```env
    DATABASE_URL="file:./database.sqlite"
    JWT_SECRET="seu_segredo_jwt"
    EVOLUTION_API_URL="URL_DA_SUA_EVOLUTION_API"
    EVOLUTION_API_KEY="SUA_CHAVE_API"
    # Configurações adicionais de Email e Meta conforme necessário
    ```
3.  **Banco de Dados:**
    ```bash
    npx prisma db push
    ```
4.  **Execução:**
    - Modo Dev: `npm run dev` (Frontend e Backend integrados via Vite Proxy se configurado, ou rode o servidor separadamente).
    - Servidor: `npm run server`.

### Docker (Produção)
Para rodar via Docker:
```bash
docker build -t tizap-saas .
docker run -p 80:80 tizap-saas
```
O sistema utiliza `nginx.conf` para roteamento de tráfego e servir os arquivos estáticos do frontend construídos em `dist`.

---

## 5. Estrutura de Diretórios Explicada

- `/prisma`: Contém o schema e as gerações do cliente de banco de dados.
- `/public`: Assets estáticos acessíveis diretamente pelo navegador.
- `/server`:
    - `/config`: Constantes globais e strings de configuração.
    - `/middleware`: Lógica de autenticação e logs de requisição.
    - `/routes`: Definição de todos os endpoints REST (Auth, Evolution, Flows, etc).
    - `/services`: O "cérebro" do sistema (FlowEngine, WhatsAppService, EmailEngine).
- `/src`:
    - `/components`: Componentes React reutilizáveis.
    - `/views`: Páginas principais da aplicação, com destaque para o `/Dashboard`.
- `/uploads`: Armazenamento local de mídias enviadas/recebidas.

---

## 6. Manutenção e Extensão

### Adicionando um Novo Nó no Canvas
1.  No `FlowBuilder.jsx` ou `AutomationBuilder.jsx`, adicione o novo tipo de nó no componente `ReactFlow`.
2.  Defina o estilo e os campos de edição na variável `NODE_STYLES`.
3.  Atualize o `FlowEngine.js` no backend para reconhecer e processar o novo `type` de nó durante a execução do fluxo.

### Criando Novas Rotas na API
1.  Crie o arquivo de rota em `server/routes/`.
2.  Importe e registre a rota no `server/index.js` usando `app.use('/api', suaRota)`.
3.  Lembre-se de aplicar o middleware `authenticateToken` se a rota exigir segurança.

### Backup e Restauração
Conforme as práticas recomendadas para bancos SQLite:
- **Backup:** Basta copiar o arquivo `ambev/database.sqlite` para um local seguro.
- **Restauração:** Substitua o arquivo existente pelo backup e reinicie o servidor.
- Recomenda-se a automação periódica desse processo via scripts Cron em ambiente Linux.

---

## Estrutura de Arquivos (Project Tree)

```text
|   .dockerignore
|   .env
|   Dockerfile
|   index.html
|   nginx.conf
|   package-lock.json
|   package.json
|   README.md
|   WEBHOOK_GUIDE.md
|   WHATSAPP_TEMPLATE_GUIDE.md
|   database.sqlite
|   vite.config.js
+---prisma
|       schema.prisma
+---public
|       logo.png
|       vite.svg
+---scripts
|   +---debug
|   \---migrations
+---server
|   |   db.js
|   |   index.js
|   +---config
|   |       constants.js
|   +---middleware
|   |       index.js
|   +---routes
|   |       admin.js
|   |       auth.js
|   |       dispatch.js
|   |       emails.js
|   |       evolution.js
|   |       flows.js
|   |       messages.js
|   |       meta.js
|   |       payment.js
|   |       uploads.js
|   |       users.js
|   |       webhooks.js
|   \---services
|           cleanupService.js
|           dispatchEngine.js
|           emailEngine.js
|           flowEngine.js
|           whatsapp.js
+---src
|   |   App.jsx
|   |   index.css
|   |   main.jsx
|   +---assets
|   +---components
|   |       BroadcastList.jsx
|   |       BulkSender.jsx
|   |       ContactFilter.jsx
|   |       ContactList.jsx
|   |       LeadTable.jsx
|   |       MessageInput.jsx
|   |       MessageList.jsx
|   |       Navbar.jsx
|   |       Sidebar.jsx
|   |       TemplateModal.jsx
|   \---views
|       +---Auth
|       |       Login.jsx
|       |       Register.jsx
|       +---Dashboard
|       |       AutomationBuilder.jsx
|       |       AutomationTab.jsx
|       |       Dashboard.jsx
|       |       EmailTab.jsx
|       |       FlowBuilder.jsx
|       |       FlowSessionsHistory.jsx
|       |       SettingsTab.jsx
|       |       SystemUsersTab.jsx
|       \---Landing
|               LandingPage.jsx
\---uploads
```

---
*Documentação gerada automaticamente para referência técnica.*
