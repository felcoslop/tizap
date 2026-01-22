# tiZAP - WhatsApp Business Automation Platform

A professional full-stack application for WhatsApp Business API automation, featuring campaign management, visual flow builder, and real-time messaging.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Database](#database)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

tiZAP is an enterprise-grade platform for automating WhatsApp Business communications through the official Meta Business API. It provides tools for mass messaging campaigns, interactive conversation flows, and real-time customer engagement.

### Key Capabilities

- Official Meta WhatsApp Business API integration
- Visual flow builder for conversational automation
- Bulk message dispatch with dynamic variable mapping
- Real-time chat interface with WebSocket support
- Email campaign management (Resend, Gmail REST API, SMTP)
- Webhook system for incoming messages and media
- Template management and approval workflow

## Architecture

### System Design

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│   Nginx     │ (Reverse Proxy)
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│   Express   │────▶│   SQLite     │
│   Server    │     │  (Prisma)    │
└──────┬──────┘     └──────────────┘
       │
       ├──▶ Meta WhatsApp API
       ├──▶ Email Services (Resend/Gmail/SMTP)
       └──▶ WebSocket Clients
```

### Directory Structure

```
ambev/
├── server/                 # Backend application
│   ├── config/            # Configuration modules
│   │   ├── email.js       # Email service configuration
│   │   └── constants.js   # Application constants
│   ├── middleware/        # Express middleware
│   │   └── index.js       # Authentication middleware
│   ├── routes/            # API route handlers
│   │   ├── auth.js        # Authentication endpoints
│   │   ├── dispatches.js  # Campaign dispatch endpoints
│   │   ├── emails.js      # Email campaign endpoints
│   │   ├── flows.js       # Flow management endpoints
│   │   ├── messages.js    # Message handling endpoints
│   │   ├── meta.js        # Meta API integration
│   │   ├── users.js       # User management endpoints
│   │   └── webhooks.js    # Webhook receivers
│   ├── services/          # Business logic layer
│   │   ├── dispatchEngine.js  # Campaign execution
│   │   ├── emailEngine.js     # Email dispatch logic
│   │   ├── flowEngine.js      # Flow execution engine
│   │   └── whatsapp.js        # WhatsApp API wrapper
│   ├── utils/             # Utility functions
│   │   └── webhookToken.js    # Token generation
│   ├── db.js              # Prisma client instance
│   └── index.js           # Server entry point
│
├── src/                   # Frontend application
│   ├── components/        # Reusable React components
│   ├── hooks/             # Custom React hooks
│   ├── views/             # Page components
│   │   ├── Dashboard/     # Main dashboard views
│   │   ├── Login.jsx      # Authentication view
│   │   └── Register.jsx   # Registration view
│   ├── App.jsx            # Root component
│   ├── main.jsx           # Application entry point
│   └── DesignSystem.css   # Global styles
│
├── prisma/                # Database configuration
│   ├── schema.prisma      # Database schema definition
│   └── migrations/        # Migration history
│
├── public/                # Static assets
│   ├── android-chrome-512x512.png
│   ├── favicon.png
│   └── logo.png
│
├── politics/              # Legal pages
│   ├── privacy.html       # Privacy policy
│   └── terms.html         # Terms of service
│
├── uploads/               # User-uploaded files (gitignored)
│
├── Dockerfile             # Production container definition
├── nginx.conf             # Reverse proxy configuration
├── vite.config.js         # Frontend build configuration
└── package.json           # Dependencies and scripts
```

## Tech Stack

### Backend
- **Runtime:** Node.js v20+
- **Framework:** Express v5
- **Database:** SQLite with Prisma ORM v6
- **Authentication:** JWT (jsonwebtoken)
- **Email:** Nodemailer, Resend API, Gmail REST API
- **File Upload:** Multer
- **WebSockets:** ws library

### Frontend
- **Framework:** React v19
- **Build Tool:** Vite v7
- **Routing:** React Router v7
- **Flow Builder:** ReactFlow v11
- **Animations:** Framer Motion v12
- **Icons:** Lucide React
- **Data Parsing:** PapaParse, XLSX

### External APIs
- Meta WhatsApp Business API (Graph API v21.0)
- Google OAuth 2.0
- Resend Email API
- Gmail REST API

## Features

### Campaign Management
- Bulk WhatsApp message dispatch from Excel/CSV
- Dynamic variable mapping (name, date, custom fields)
- Template-based messaging with Meta-approved templates
- Real-time progress tracking
- Error handling and retry mechanisms

### Flow Builder
- Visual drag-and-drop interface
- Node types: Message, Options, Image, Conditional, Delay
- Variable substitution and dynamic content
- Session management with state persistence
- Multi-step conversation flows

### Email Campaigns
- HTML email templates
- Bulk email dispatch
- Multiple provider support (Resend, Gmail, SMTP)
- Campaign tracking and analytics

### Real-time Messaging
- WebSocket-based chat interface
- Incoming message webhooks
- Media support (images, audio, documents)
- Contact management
- Read receipts

### Security
- JWT-based authentication
- Password hashing with bcrypt
- Google OAuth integration
- Webhook token verification
- Environment-based secrets

## Prerequisites

- Node.js v20 or higher
- npm or yarn package manager
- Meta Developer Account with WhatsApp Business API access
- (Optional) Gmail account for email features
- (Optional) Resend API key for email features

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/felcoslop/tizap.git
cd tizap/ambev
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Initialize Database

```bash
npx prisma db push
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=80
NODE_ENV=production

# Database
DATABASE_URL=file:/data/database.sqlite

# Authentication
JWT_SECRET=your-secure-random-string-here

# Email Configuration (Choose one or multiple)
# Option 1: Resend API
RESEND_API_KEY=re_your_resend_api_key

# Option 2: Gmail REST API
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Option 3: SMTP (Fallback)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587

# Google OAuth (Optional - for social login)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

### Meta WhatsApp Business API Setup

1. Create a Meta Developer account at https://developers.facebook.com
2. Create a new app and add WhatsApp product
3. Configure webhook URL: `https://your-domain.com/webhook/token/{your-token}`
4. Obtain:
   - Phone Number ID
   - WhatsApp Business Account ID (WABA ID)
   - Access Token
5. Create and approve message templates in Meta Business Manager

See [WEBHOOK_GUIDE.md](./WEBHOOK_GUIDE.md) and [WHATSAPP_TEMPLATE_GUIDE.md](./WHATSAPP_TEMPLATE_GUIDE.md) for detailed instructions.

## Development

### Running Locally

#### Option 1: Separate Processes (Recommended for Development)

```bash
# Terminal 1: Backend server
npm run server

# Terminal 2: Frontend dev server
npm run dev
```

Access the application at `http://localhost:5173`

#### Option 2: Production Mode

```bash
# Build frontend and start server
npm run build
npm start
```

Access the application at `http://localhost:80`

### Available Scripts

```bash
npm run dev          # Start Vite dev server (frontend only)
npm run build        # Build production frontend
npm run preview      # Preview production build
npm start            # Run Prisma migrations + start server
npm run server       # Start backend server only
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Apply database migrations
npm run prisma:studio    # Open Prisma Studio (database GUI)
```

### Development Workflow

1. Make changes to source code
2. Frontend changes hot-reload automatically (Vite HMR)
3. Backend changes require server restart
4. Database schema changes:
   ```bash
   # Edit prisma/schema.prisma
   npx prisma db push
   npx prisma generate
   ```

## Production Deployment

### Docker Deployment

#### Build Image

```bash
docker build -t tizap:latest .
```

#### Run Container

```bash
docker run -d \
  --name tizap \
  -p 80:80 \
  -v tizap_data:/data \
  --env-file .env \
  tizap:latest
```

#### Docker Compose (Recommended)

```yaml
version: '3.8'
services:
  tizap:
    build: .
    ports:
      - "80:80"
    volumes:
      - tizap_data:/data
      - ./uploads:/app/uploads
    env_file:
      - .env
    restart: unless-stopped

volumes:
  tizap_data:
```

### Platform-Specific Deployment

#### Easypanel / Coolify
1. Connect GitHub repository
2. Set environment variables in platform UI
3. Configure volume mount for `/data`
4. Deploy

#### VPS (Ubuntu/Debian)
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Clone and deploy
git clone https://github.com/felcoslop/tizap.git
cd tizap/ambev
docker-compose up -d
```

### Reverse Proxy (Nginx)

The included `nginx.conf` handles:
- Static file serving
- API proxying
- WebSocket upgrades
- Gzip compression

For external Nginx:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Database

### Schema Overview

Key models:
- **User** - User accounts and authentication
- **UserConfig** - WhatsApp/Email API credentials per user
- **Dispatch** - Campaign execution records
- **Flow** - Conversation flow definitions
- **FlowSession** - Active flow execution states
- **ReceivedMessage** - Incoming message history
- **EmailTemplate** - Email campaign templates
- **EmailCampaign** - Email campaign records

### Migrations

```bash
# Apply pending migrations
npx prisma db push

# Create new migration
npx prisma migrate dev --name description

# Reset database (WARNING: Data loss)
npx prisma migrate reset
```

### Backup and Restore

See [BACKUP-RESTORE.md](./BACKUP-RESTORE.md) for detailed procedures.

Quick backup:
```bash
# Backup database
cp /data/database.sqlite /data/backup-$(date +%Y%m%d).sqlite

# Restore database
cp /data/backup-YYYYMMDD.sqlite /data/database.sqlite
```

## API Documentation

### Authentication

All API endpoints (except `/auth/*`) require JWT authentication.

```bash
# Login
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "email": "user@example.com", "name": "User" }
}

# Authenticated requests
GET /api/user/1
Authorization: Bearer {token}
```

### Key Endpoints

```
POST   /auth/register          # Create account
POST   /auth/login             # Authenticate
POST   /auth/google            # Google OAuth

GET    /api/user/:id           # Get user profile
POST   /api/user-config/:id    # Update WhatsApp/Email config

GET    /api/dispatch/:userId   # List campaigns
POST   /api/start-dispatch     # Start new campaign
POST   /api/dispatch/:id/retry # Retry failed messages

GET    /api/flows/:userId      # List flows
POST   /api/flows              # Create flow
PUT    /api/flows/:id          # Update flow
DELETE /api/flows/:id          # Delete flow

GET    /api/messages/:userId   # Get message history
POST   /api/send-message       # Send manual message
POST   /api/messages/delete    # Delete conversations

POST   /webhook/token/:token   # Receive Meta webhooks
GET    /webhook/token/:token   # Webhook verification
```

## Security

### Best Practices

1. **Environment Variables**
   - Never commit `.env` to version control
   - Use strong, random JWT_SECRET
   - Rotate API keys regularly

2. **Database**
   - Database file is gitignored
   - Regular backups recommended
   - Sensitive data encrypted at rest

3. **File Uploads**
   - Uploads directory is gitignored
   - File type validation enforced
   - Size limits configured

4. **API Security**
   - JWT expiration: 7 days
   - Password hashing: bcrypt (10 rounds)
   - CORS configured for production domains

5. **Webhook Security**
   - Unique tokens per user
   - Token-based URL authentication
   - Verify Meta webhook signatures

### Known Limitations

- SQLite is single-writer (not suitable for high concurrency)
- No rate limiting implemented (add nginx rate limiting)
- Session storage in database (consider Redis for scale)

## Troubleshooting

### Common Issues

#### Database Locked Error
```
Error: SQLITE_BUSY: database is locked
```
**Solution:** SQLite doesn't handle concurrent writes well. Ensure only one process accesses the database, or migrate to PostgreSQL for production.

#### Webhook Not Receiving Messages
1. Verify webhook URL in Meta dashboard
2. Check webhook token matches user config
3. Ensure server is publicly accessible
4. Check server logs for incoming requests

#### Email Not Sending
1. Verify email configuration in `.env`
2. Check Gmail "Less secure app access" or use App Password
3. For Resend: verify API key and domain verification
4. Check server logs for SMTP errors

#### Flow Not Continuing After User Response
1. Verify phone number normalization (55 prefix for Brazil)
2. Check flow session status in database
3. Ensure webhook is configured correctly
4. Check logs for session matching errors

### Debug Mode

Enable detailed logging:
```bash
# Set in .env
NODE_ENV=development

# Check logs
tail -f server.log
```

### Utility Scripts

```bash
# Clear all flow sessions
node clear_sessions.js

# Migrate phone numbers to normalized format
node migrate_phones.js

# Generate webhook tokens for existing users
node generate_webhook_tokens.js

# Test email configuration
node test_smtp.js
```

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

### Code Style

- Use ES6+ features
- Follow existing code structure
- Add comments for complex logic
- Update documentation for API changes

### Commit Messages

```
feat: add new feature
fix: bug fix
docs: documentation update
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

### Testing

```bash
# Run tests (when implemented)
npm test

# Lint code (when configured)
npm run lint
```

## License

This project is proprietary software developed for internal use.

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/felcoslop/tizap/issues
- Documentation: See `docs/` directory
- Email: support@example.com

## Acknowledgments

Developed for Ambev logistics team.

Built with:
- React, Express, Prisma
- Meta WhatsApp Business API
- ReactFlow for visual flow builder
- Vite for blazing-fast development

---

Last updated: 2026-01-22  
Version: 1.0-stable
