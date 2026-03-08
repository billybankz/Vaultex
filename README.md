# Vaultex - E2E Encrypted Vault

Vaultex is a secure, zero-knowledge password vault built with React and Supabase. It features client-side encryption (AES-GCM), Supabase Auth, and a serverless email function for password recovery.

## 🚀 Features

- **End-to-End Encryption**: Passwords are encrypted in the browser before being stored.
- **Role-Based Access Control**: Strict access between users and administrators.
- **Secure Authentication**: SHA-256 password hashing for login.
- **Admin Panel**: Manage users, reset credentials, and delete accounts without ever seeing user passwords.
- **Email Recovery**: Self-reset and admin-led reset flows integrated with Resend API.
- **Theme Toggles**: Support for light and dark modes.

## 🚀 Cloud Architecture
This project is designed to be fully serverless:
- **Frontend**: Hosted on **Netlify**.
- **Backend/Auth**: Powered by **Supabase**.
- **Email Service**: Running as a **Netlify Function**.

## 🛡️ Security Model (Zero-Knowledge)
- **Encryption**: All data is encrypted in the browser using a key derived from your Master Password.
- **Privacy**: The encryption key and plaintext data never leave your device.
- **Storage**: Supabase only stores encrypted blobs that cannot be read by anyone without your Master Password.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Lucide-React, Axios, CryptoJS
- **Backend**: HashiCorp Vault (Docker)
- **Email Service**: Node.js, Express, Nodemailer (Resend API)

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
