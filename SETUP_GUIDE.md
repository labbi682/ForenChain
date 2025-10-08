# ForenChain - Complete Setup Guide

## Step-by-Step Installation Instructions

### Step 1: Install Prerequisites

#### Install Node.js
1. Download from https://nodejs.org/ (v18 or higher)
2. Run installer and follow prompts
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### Install MongoDB
1. Download from https://www.mongodb.com/try/download/community
2. Install MongoDB Community Edition
3. Start MongoDB service:
   ```bash
   # Windows
   net start MongoDB
   
   # Or run manually
   mongod
   ```

### Step 2: Setup Backend

1. Open PowerShell/Terminal in backend folder:
   ```bash
   cd c:/Users/labeebah/OneDrive/Desktop/Forein-Chain/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file in backend folder:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/forenchain
   JWT_SECRET=forenchain_secret_key_2024_change_this
   BLOCKCHAIN_RPC=https://rpc-mumbai.maticvigil.com/
   PRIVATE_KEY=
   CONTRACT_ADDRESS=
   PINATA_API_KEY=
   PINATA_SECRET_KEY=
   PINATA_JWT=
   ```

4. Start backend server:
   ```bash
   npm run dev
   ```

   You should see:
   ```
   ✅ MongoDB Connected
   🚀 ForenChain Server running on port 5000
   ```

### Step 3: Setup Frontend

1. Open NEW PowerShell/Terminal in frontend folder:
   ```bash
   cd c:/Users/labeebah/OneDrive/Desktop/Forein-Chain/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file in frontend folder:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. Start frontend:
   ```bash
   npm run dev
   ```

   You should see:
   ```
   VITE ready in XXX ms
   ➜  Local:   http://localhost:3000/
   ```

### Step 4: Access Application

1. Open browser and go to: **http://localhost:3000**
2. Click "Register here" to create account
3. Fill in registration form:
   - Username: admin
   - Email: admin@forenchain.com
   - Password: admin123
   - Role: Admin
4. Click "Create Account"
5. Login with your credentials

### Step 5: Test the System

#### Upload Evidence
1. Click "Upload" in sidebar
2. Select a file (image, document, etc.)
3. Enter case number: CASE-2024-001
4. Add description
5. Click "Upload Evidence"

#### Verify Evidence
1. Go to "Evidence" page
2. Click "View" on uploaded evidence
3. Click "Verify Integrity" button
4. System will verify file hash

#### Download Report
1. On evidence detail page
2. Click "Download Report"
3. PDF report will be generated

## Optional: Blockchain Setup

### Deploy Smart Contract (Advanced)

1. Get Polygon Mumbai testnet MATIC:
   - Visit https://faucet.polygon.technology/
   - Enter your wallet address
   - Get free test MATIC

2. Setup blockchain folder:
   ```bash
   cd c:/Users/labeebah/OneDrive/Desktop/Forein-Chain/blockchain
   npm install
   ```

3. Create `.env` in blockchain folder:
   ```env
   PRIVATE_KEY=your_wallet_private_key
   POLYGON_MUMBAI_RPC=https://rpc-mumbai.maticvigil.com/
   ```

4. Deploy contract:
   ```bash
   npm run deploy:mumbai
   ```

5. Copy contract address to backend `.env`:
   ```env
   CONTRACT_ADDRESS=0x...
   ```

## Optional: IPFS Setup

### Setup Pinata for IPFS Storage

1. Sign up at https://pinata.cloud (free account)
2. Go to API Keys section
3. Create new API key
4. Copy JWT token
5. Add to backend `.env`:
   ```env
   PINATA_JWT=your_jwt_token_here
   ```

## Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is running: `mongod`
- Check connection string in `.env`
- Try: `mongodb://127.0.0.1:27017/forenchain`

### Port Already in Use
- Backend: Change PORT in backend `.env`
- Frontend: Change port in `vite.config.js`

### Module Not Found Errors
- Delete `node_modules` folder
- Delete `package-lock.json`
- Run `npm install` again

### CORS Errors
- Make sure backend is running on port 5000
- Check VITE_API_URL in frontend `.env`

## Development Mode

Keep both terminals running:
- Terminal 1: Backend (`cd backend && npm run dev`)
- Terminal 2: Frontend (`cd frontend && npm run dev`)

## Production Deployment

### Build Frontend
```bash
cd frontend
npm run build
```

### Start Backend in Production
```bash
cd backend
NODE_ENV=production npm start
```

## Quick Commands Reference

```bash
# Start MongoDB
mongod

# Backend
cd backend
npm install          # Install dependencies
npm run dev          # Development mode
npm start            # Production mode

# Frontend
cd frontend
npm install          # Install dependencies
npm run dev          # Development mode
npm run build        # Build for production

# Blockchain
cd blockchain
npm install          # Install dependencies
npm run compile      # Compile contracts
npm run deploy:mumbai # Deploy to testnet
```

## Default Test Accounts

After registration, you can create multiple accounts with different roles:

**Admin Account**
- Username: admin
- Role: Admin
- Can view all evidence

**Investigator Account**
- Username: investigator1
- Role: Investigator
- Can upload and manage evidence

**Court Account**
- Username: court1
- Role: Court
- Can view evidence and download reports

## Support

If you encounter issues:
1. Check all services are running (MongoDB, Backend, Frontend)
2. Check browser console for errors (F12)
3. Check terminal logs for error messages
4. Verify all `.env` files are created correctly

---

**You're all set! Start using ForenChain for secure evidence management.**
