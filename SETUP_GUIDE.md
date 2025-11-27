# Admin Panel Setup Guide

This guide will help you set up and run the admin panel for managing retailers.

## Project Structure

- **backend/** - Node.js/Express API with Firebase Auth and MongoDB
- **admin-panel/** - Next.js admin interface with TanStack Query

## Prerequisites

- Node.js 18+ installed
- MongoDB database (local or cloud)
- Firebase project with Admin SDK

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Update `.env` with your credentials:
```env
PORT=9000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
MONGODB_DB_NAME=balwinder

# Firebase - Get from Firebase Console > Project Settings > Service Accounts
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_PROJECT_ID=your-project-id
```

### 3. Start the Backend

```bash
npm run dev
```

Backend will run on http://localhost:9000

## Frontend Setup

### 1. Install Dependencies

```bash
cd admin-panel
npm install
```

### 2. Configure Environment Variables

Create/Update `.env.local` file with your Firebase config:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:9000
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 3. Start the Frontend

```bash
npm run dev
```

Frontend will run on http://localhost:3000

## Creating Your First Admin User

Use Postman to create an admin user:

**POST** `http://localhost:9000/api/v1/admin/create-admin-user`

**Body (JSON):**
```json
{
  "email": "admin@example.com",
  "password": "yourpassword123",
  "displayName": "Admin User"
}
```

## Using the Admin Panel

1. Go to http://localhost:3000 and login with admin credentials
2. Click "Manage Retailers" in the sidebar
3. Create, edit, or delete retailers

## API Endpoints

### Admin
- `POST /api/v1/admin/create-admin-user` - Create admin user

### Retailers (Require Admin Auth)
- `GET /api/v1/retailers` - List retailers
- `POST /api/v1/retailers` - Create retailer
- `PUT /api/v1/retailers/:id` - Update retailer
- `DELETE /api/v1/retailers/:id` - Delete retailer

## Features

✅ Firebase Auth with custom claims (admin/retailer roles)
✅ MongoDB with Mongoose
✅ TanStack Query for data fetching
✅ Form validation (email, phone, pincode)
✅ Searchable Indian states dropdown
✅ 0-safe pincode input
✅ Pagination and search
✅ Protected routes

