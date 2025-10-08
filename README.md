# ForenChain - Blockchain-Powered Digital Evidence Management

ForenChain is a secure blockchain-powered web platform that ensures the authenticity, traceability, and integrity of digital evidence throughout its entire lifecycle.

## 🔐 Key Features

- **Blockchain Storage**: Immutable evidence metadata stored on Polygon blockchain
- **Chain of Custody**: Complete tracking from upload → verify → transfer → close
- **AI Classification**: Automatic evidence categorization
- **Digital Signatures**: Cryptographic proof of authenticity
- **Geo-tagging**: Location verification for uploads
- **Real-time Dashboard**: Analytics and tampering alerts
- **Court Reports**: Auto-generated PDF validation reports
- **QR Verification**: Mobile-friendly evidence verification
- **IPFS Storage**: Decentralized file storage

## ⚙ Tech Stack

- **Frontend**: React.js + Vite + TailwindCSS
- **Backend**: Node.js + Express.js
- **Blockchain**: Polygon (Solidity smart contracts)
- **Storage**: IPFS + Pinata
- **Database**: MongoDB
- **AI/ML**: File classification engine
- **Authentication**: JWT + bcrypt

## 📦 Installation

### Prerequisites

- Node.js (v18+)
- MongoDB (v6+)
- Git

### 1. Clone Repository

```bash
cd c:/Users/labeebah/OneDrive/Desktop/Forein-Chain
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/forenchain
JWT_SECRET=your_secret_key_here
BLOCKCHAIN_RPC=https://rpc-mumbai.maticvigil.com/
PINATA_JWT=your_pinata_jwt_token
```

Start backend:
```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
```

Start frontend:
```bash
npm run dev
```

### 4. Blockchain Setup (Optional)

```bash
cd ../blockchain
npm install
```

Deploy smart contract:
```bash
npm run deploy:mumbai
```

## 🚀 Quick Start

1. **Start MongoDB**:
   ```bash
   mongod
   ```

2. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   npm run dev
   ```

3. **Start Frontend** (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

4. **Access Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api

## 📖 Usage

### Register Account
1. Go to http://localhost:3000/register
2. Create account with role (Investigator/Admin/Court)
3. Login with credentials

### Upload Evidence
1. Navigate to "Upload" page
2. Select file and enter case details
3. Optionally add location data
4. Submit - evidence is hashed and stored on blockchain

### Verify Evidence
1. Go to evidence detail page
2. Click "Verify Integrity"
3. System re-calculates hash and compares with blockchain

### Generate Court Report
1. Open evidence detail page
2. Click "Download Report"
3. PDF with complete chain of custody is generated

## 🔧 Configuration

### IPFS/Pinata Setup
1. Sign up at https://pinata.cloud
2. Get JWT token
3. Add to backend `.env`:
   ```env
   PINATA_JWT=your_jwt_token
   ```

### Blockchain Setup
1. Get Polygon Mumbai testnet MATIC from faucet
2. Deploy contract: `npm run deploy:mumbai`
3. Add contract address to `.env`

## 📁 Project Structure

```
Forein-Chain/
├── backend/
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API endpoints
│   ├── services/        # Blockchain, IPFS, AI
│   └── server.js        # Express server
├── frontend/
│   ├── src/
│   │   ├── pages/       # React pages
│   │   ├── components/  # Reusable components
│   │   ├── store/       # State management
│   │   └── api/         # API client
│   └── package.json
├── blockchain/
│   ├── contracts/       # Solidity contracts
│   └── scripts/         # Deployment scripts
└── README.md
```

## 🔒 Security Features

- **SHA-256 Hashing**: Cryptographic file integrity
- **JWT Authentication**: Secure API access
- **Role-Based Access**: Investigator/Admin/Court permissions
- **Blockchain Immutability**: Tamper-proof records
- **Audit Logging**: Complete action history

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get profile

### Evidence
- `POST /api/evidence/upload` - Upload evidence
- `GET /api/evidence` - List evidence
- `GET /api/evidence/:id` - Get evidence details
- `POST /api/evidence/:id/verify` - Verify integrity
- `POST /api/evidence/:id/transfer` - Transfer ownership

### Audit
- `GET /api/audit/evidence/:id` - Get evidence audit logs
- `GET /api/audit/report/:id` - Download PDF report

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📄 License

MIT License - see LICENSE file

## 👥 Team

ForenChain Development Team

## 📧 Support

For issues and questions, please open a GitHub issue.

---

**Built with ❤️ for digital forensics and law enforcement**
