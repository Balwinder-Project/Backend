# Frontend API Documentation

Base URL: `http://localhost:9000/api/v1`

---

## Authentication APIs

### Google Sign-In
**Endpoint:** `POST /auth/google-signin`

**Description:** Authenticate user with Google and auto-create/update user in MongoDB with wallet.

**Request Body:**
```json
{
  "firebaseUid": "string (required)",
  "email": "string (required)",
  "name": "string (required)",
  "profilePicture": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User authenticated successfully",
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "profilePicture": "string",
    "firebaseUid": "string",
    "role": "user",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

---

## User APIs

### Get User Profile
**Endpoint:** `GET /users/:id`

**Description:** Fetch user details by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "profilePicture": "string",
    "firebaseUid": "string",
    "role": "user",
    "createdAt": "ISO date",
    "updatedAt": "ISO date"
  }
}
```

---

## Wallet APIs

### Get Wallet Details
**Endpoint:** `GET /wallets/user/:userId`

**Description:** Get wallet balance and recent transactions.

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 1500.50,
    "createdAt": "ISO date",
    "recentTransactions": [
      {
        "id": "string",
        "type": "TOP_UP | DEDUCTION | PURCHASE | REFUND",
        "amount": 100.00,
        "balanceBefore": 1400.50,
        "balanceAfter": 1500.50,
        "description": "string",
        "createdAt": "ISO date"
      }
    ]
  }
}
```

### Get Wallet Balance
**Endpoint:** `GET /wallets/user/:userId/balance`

**Description:** Get current wallet balance only.

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 1500.50
  }
}
```

### Get Wallet Transactions
**Endpoint:** `GET /wallets/user/:userId/transactions?page=1&limit=10`

**Description:** Get wallet transaction history with pagination.

**Query Parameters:**
- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "walletId": "string",
      "type": "TOP_UP | DEDUCTION | PURCHASE | REFUND | ADMIN_ADJUSTMENT",
      "amount": 100.00,
      "balanceBefore": 1400.50,
      "balanceAfter": 1500.50,
      "description": "string",
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

## Transaction Types

- `TOP_UP` - Money added to wallet (credit)
- `DEDUCTION` - Money removed from wallet (debit)
- `PURCHASE` - Purchase transaction (debit)
- `REFUND` - Refund transaction (credit)
- `ADMIN_ADJUSTMENT` - Manual adjustment by admin

---

## Authentication

All API requests should include Firebase authentication token:

```
Authorization: Bearer <firebase-id-token>
```

---

## Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "errors": ["Array of error details (if applicable)"]
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## Notes

1. **Wallet Auto-Creation:** Wallets are automatically created with ₹0 balance when users sign in with Google for the first time.

2. **Balance Protection:** Wallet balance cannot go negative. DEDUCTION and PURCHASE transactions will fail if insufficient funds.

3. **Transaction History:** All wallet operations are tracked with complete audit trail including balance before/after each transaction.

4. **Pagination:** All list endpoints support pagination with `page` and `limit` query parameters.


