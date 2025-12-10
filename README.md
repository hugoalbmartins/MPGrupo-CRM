# CRM System - Bolt Ready

A complete CRM system built with React, Vite, Tailwind CSS, and Supabase.

## 🚀 Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (configured in .env)

## 🏗️ Project Structure

```
├── src/               # Source code
│   ├── components/   # React components
│   ├── pages/        # Page components
│   ├── lib/          # Utilities & Supabase
│   └── services/     # API services
├── public/           # Static assets
├── backend/          # Python backend (optional)
├── supabase/         # Database migrations
└── build/            # Production build
```

## 🔐 Environment Setup

Create a `.env` file with:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📚 Documentation

- [BOLT_READY.md](./BOLT_READY.md) - Complete Bolt migration guide
- [VITE_MIGRATION_COMPLETE.md](./VITE_MIGRATION_COMPLETE.md) - Vite migration details
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

## ✅ Features

- User authentication & authorization
- Dashboard with metrics
- Partners management
- Sales tracking
- Forms with file upload
- Role-based access control
- Responsive design

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS
- **UI:** Radix UI + shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Backend:** Python/Flask (optional)

## 📦 Build Status

✅ Build successful (13.63s)
✅ Bundle size: 1.08 MB (gzipped: 311 KB)
✅ Bolt compatible
✅ Production ready

---

Made with ❤️ using Bolt
