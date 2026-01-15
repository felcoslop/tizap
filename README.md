# tizap! - WhatsApp Automation Platform

Technical documentation for the tizap! messaging management system.

## Core Features

- **Meta Business API Integration**: Native support for WhatsApp Business API for official message delivery.
- **Mass Template Dispatch**: Automated notification system using Meta-approved templates with dynamic variable mapping.
- **Visual Flow Builder**: Interactive editor based on ReactFlow for designing complex conversational branches.
- **Real-time Chat Management**: Unified interface for receiving and responding to customer messages via WebSockets.
- **Data Import**: Support for XLSX and CSV lead data parsing and processing.
- **Operational Auditing**: Detailed logging of all dispatches, delivery statuses, and interactive session histories.
- **Webhook Management**: Dynamic webhook generation and validation for Meta event synchronization.

## Technology Stack

- **Frontend**: React (Vite), ReactFlow, Lucide Icons, Framer Motion.
- **Backend**: Node.js, Express.
- **Database**: SQLite with Prisma ORM.
- **Communication**: WebSockets (WS), Axios for REST API calls.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Meta Business Account with WhatsApp Business API access

## Installation

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Create a `.env` file in the root directory and define the following:
   ```env
   PORT=3000
   DATABASE_URL="file:./prisma/dev.db"
   ```

3. Initialize the database:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

## Development and Execution

### Running the Project
The project requires both the frontend and backend to be running.

**Standard Start (Combined):**
```bash
npm start
```

**Manual Start:**
1. Start the Backend Server:
   ```bash
   npm run server
   ```
2. Start the Frontend Development Server:
   ```bash
   npm run dev
   ```

## Functional Modules

### 1. Automation Tab
- Upload contact lists (XLSX/CSV).
- Select and configure WhatsApp templates.
- Map spreadsheet columns to template placeholders.
- Real-time dispatch monitoring with progress metrics.

### 2. Flow Builder
- Visual node-based editor for automated sequences.
- Support for text, image, and interactive button messages.
- Edge-based logic for branching conversations.
- Deployment to active phone numbers via the dispatch engine.

### 3. Messaging Dashboard
- View incoming messages from contacts.
- Live chat functionality with instant response capabilities.
- Status synchronization via official webhooks.

### 4. History and Analytics
- Campaign-level logs showing success and error rates.
- Individual session logs for detailed flow debugging.
- Retry mechanisms for failed message attempts.

## Configuration for Meta

To enable messaging, navigate to the Settings tab and configure:
1. **Access Token**: Permanent or temporary token from the Meta App Dashboard.
2. **Phone Number ID**: ID of the specific WhatsApp number to be used for sending.
3. **WABA ID**: WhatsApp Business Account ID.
4. **Webhook URL**: Configure the generated URL in the Meta Webhooks section (Events: `messages`).
