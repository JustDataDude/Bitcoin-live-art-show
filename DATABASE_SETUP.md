# 🗄️ Database Setup Complete!

## ✅ What's Been Done:

1. **Schema Updated** - Added chat messages, user relations, tip messages
2. **Migration Created** - Database structure is ready
3. **Seed Data** - Sample users, show, lot, bids, and tips

## 🚀 To Apply Changes:

### Step 1: Stop All Servers
Stop both your dev servers (Ctrl+C):
- Next.js (port 3000)
- WebSocket server (port 4001)

### Step 2: Regenerate Prisma Client & Seed Database

```powershell
# Navigate to db package
cd packages/db

# Generate Prisma client
npx prisma generate

# Reset and seed the database
npx prisma migrate reset --force

# Go back to root
cd ../..
```

### Step 3: Restart Servers

**Terminal 1 - WebSocket Server:**
```powershell
cd apps/ws
npm run dev
```

**Terminal 2 - Next.js:**
```powershell
cd apps/web
npm run dev
```

## 📊 Database Models:

- **User** - Handles, usernames, wallet connections
- **Wallet** - Crypto wallet addresses (BTC, ETH)
- **Show** - Game show episodes
- **Lot** - Items being auctioned
- **Bid** - User bids with amounts
- **Tip** - Tips with optional messages
- **ChatMessage** - Persistent chat history
- **Payment** - Transaction records
- **InscriptionRequest** - Bitcoin inscription tracking

## 🔧 Next Steps:

1. Update API routes to use database instead of mocks
2. Connect WebSocket events to save to database
3. Add user authentication with wallet signatures

## 📝 Database Location:

- **SQLite file**: `packages/db/prisma/dev.db`
- **Migrations**: `packages/db/prisma/migrations/`
- **Schema**: `packages/db/prisma/schema.prisma`

## 🛠️ Useful Commands:

```powershell
# View database in browser
cd packages/db
npx prisma studio

# Create new migration
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

