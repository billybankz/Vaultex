# Vaultex - E2E Encrypted Vault

Vaultex is a secure, zero-knowledge password vault application built with React and HashiCorp Vault. It features client-side encryption, role-based access control, and a dedicated email microservice for password recovery.

## 🚀 Features

- **End-to-End Encryption**: Passwords are encrypted in the browser before being stored.
- **Role-Based Access Control**: Strict access between users and administrators.
- **Secure Authentication**: SHA-256 password hashing for login.
- **Admin Panel**: Manage users, reset credentials, and delete accounts without ever seeing user passwords.
- **Email Recovery**: Self-reset and admin-led reset flows integrated with Resend API.
- **Theme Toggles**: Support for light and dark modes.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Lucide-React, Axios, CryptoJS
- **Backend**: HashiCorp Vault (Docker)
- **Email Service**: Node.js, Express, Nodemailer (Resend API)

## 📦 Setup & Installation

### 1. Prerequisites
- Docker & Docker Compose
- Node.js (v18+)

### 2. Backend (Vault)
```bash
docker compose up -d
```

### 3. Email Service
1. Navigate to the `email-service` directory.
2. Create a `.env` file with your Resend API key:
   ```
   RESEND_API_KEY=your_key_here
   PORT=3001
   ```
3. Install dependencies and start:
   ```bash
   npm install
   node index.js
   ```

### 4. Frontend (Vaultex UI)
1. Navigate to the `vault-ui` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🛡️ Security

Zero-knowledge is the core design:
- Your master key is never sent to the server.
- The administrator can reset your account but can NEVER read your passwords.
- Only the SHA-256 hash of your password is used for authentication.

## 🧪 Testing Accounts

| Username | Password    | Role  |
|----------|-------------|-------|
| `admin`  | `Admin@123` | Admin |
| `alice`  | `Alice@123` | User  |

---

Built for secure, private password management.
