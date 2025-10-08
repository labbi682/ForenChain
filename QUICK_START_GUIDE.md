# ForenChain Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Dependencies
```bash
cd backend
npm install uuid
```

### Step 2: Update server.js
Add these lines to your `backend/server.js`:

```javascript
// Add after existing route imports
const authWithCaseId = require('./routes/authWithCaseId');
const caseRoutes = require('./routes/caseRoutes');
const evidenceWithCaseId = require('./routes/evidenceWithCaseId');

// Add after existing routes
app.use('/api/auth', authWithCaseId);
app.use('/api/cases', caseRoutes);
app.use('/api/evidence', evidenceWithCaseId);
```

### Step 3: Create .env file
```bash
PORT=5000
MONGODB_URI=mongodb://localhost:27017/forenchain
JWT_SECRET=change-this-to-secure-random-string
NODE_ENV=development
```

### Step 4: Start Services
```bash
# Terminal 1: Start MongoDB
mongod

# Terminal 2: Start Backend
cd backend
node server.js

# Terminal 3: Open Frontend
cd ..
start login-with-caseid.html
```

## 📋 Test the System

### Create Admin User (MongoDB)
```javascript
use forenchain
db.userwithcaseaccesses.insertOne({
  username: "admin",
  email: "admin@forenchain.com",
  phone: "+1234567890",
  password: "$2a$12$hashed_password_here", // Use bcrypt to hash
  role: "admin",
  isActive: true,
  kyc: { isVerified: true },
  associatedCaseIds: [],
  createdAt: new Date()
})
```

### Create Test Case
```bash
POST http://localhost:5000/api/cases/create
Headers: Authorization: Bearer <admin-token>
Body: {
  "caseName": "Test Case",
  "caseNumber": "CASE-001",
  "description": "Test case for system"
}
```

## 🎯 Key Features Implemented

✅ Case ID-based login
✅ Two-step authentication (Password + OTP)
✅ KYC verification system
✅ Role-based access control
✅ Case-specific evidence access
✅ File encryption
✅ Audit logging
✅ Account lockout protection
✅ Session management

## 📞 Support
Check CASE_ID_IMPLEMENTATION.md for full documentation.
