# CMS Banking Platform - Frontend

Modern, responsive web application for the Credit Management System built with Next.js 14+, React, TypeScript, and Tailwind CSS.

## 🚀 Tech Stack

- **Framework**: Next.js 14+ (App Router, SSR)
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS + Emotion
- **API**: Apollo Client (GraphQL) + Axios (REST)
- **PWA**: next-pwa for Progressive Web App support
- **UI**: Fully responsive, mobile-first design
- **Forms**: React Hook Form + Zod validation

## 📋 Prerequisites

- Node.js 18+ and npm 9+
- Backend API running on `http://localhost:8081`
- Database configured and migrated

## 🛠️ Installation

1. **Navigate to frontend directory**:
   ```bash
   cd /Users/rajat/Desktop/Code/project_cms/cms-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   cp .env.local.example .env.local
   ```

4. **Update environment variables** in `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8081
   NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8081/graphql
   NEXT_PUBLIC_DEFAULT_BANK_ID=123e4567-e89b-12d3-a456-426614174000
   ```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

Application will be available at **http://localhost:3000**

### Production Build

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Code Formatting

```bash
npm run format
```

## 📱 Progressive Web App (PWA)

The application is a fully functional PWA with:

- ✅ Offline support
- ✅ Install to home screen
- ✅ Push notifications (coming soon)
- ✅ Service worker caching
- ✅ App shell architecture

To test PWA features:

1. Run production build: `npm run build && npm start`
2. Open DevTools > Application > Service Workers
3. Check "Offline" to test offline functionality

## 🎨 Features

### Public Pages (SSR)

- **Homepage** (`/`) - Marketing page with hero, features, CTA
- **Login** (`/login`) - Authentication for bank users and customers
- **Register** (`/register`) - User registration with role selection
- **About** (`/about`) - Company information
- **Pricing** (`/pricing`) - Pricing plans

### Authenticated Pages (SPA)

- **Dashboard** (`/dashboard`) - Main dashboard with analytics
- **Applications** (`/dashboard/applications`) - Loan applications
- **Customers** (`/dashboard/customers`) - Customer management
- **Portfolio** (`/dashboard/portfolio`) - Loan portfolio
- **Reports** (`/dashboard/reports`) - Analytics and reports
- **Settings** (`/dashboard/settings`) - User and system settings

## 🔐 Authentication

The app supports two types of users:

### Bank User (Staff/Admin)

- Employee number required
- Department and job title
- Full system access based on role

### Customer

- Customer ID required
- Limited access to own data
- Self-service portal

### Login Flow

1. User enters credentials (username + password)
2. Backend validates and returns JWT tokens
3. Access token stored in memory, refresh token in localStorage
4. Auto-refresh before token expiration
5. Redirect to dashboard on success

## 📁 Project Structure

```
cms-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Auth-related pages
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   └── dashboard/
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Homepage
│   │   ├── providers.tsx      # Redux & Apollo providers
│   │   └── globals.css        # Global styles
│   ├── components/            # Reusable components
│   │   ├── marketing/         # Public page components
│   │   ├── dashboard/         # Dashboard components
│   │   └── common/            # Shared components
│   ├── lib/                   # Libraries and utilities
│   │   ├── api-client.ts      # Axios configuration
│   │   └── apollo-client.ts   # GraphQL client
│   ├── services/              # API service layers
│   │   └── auth.service.ts    # Authentication service
│   ├── store/                 # Redux store
│   │   ├── index.ts           # Store configuration
│   │   └── slices/            # Redux slices
│   ├── types/                 # TypeScript types
│   ├── hooks/                 # Custom React hooks
│   ├── utils/                 # Utility functions
│   └── config/                # App configuration
├── public/                    # Static assets
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # App icons
├── next.config.js             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS config
├── tsconfig.json              # TypeScript config
└── package.json               # Dependencies
```

## 🔗 API Integration

### REST API (Axios)

```typescript
import apiClient from '@/lib/api-client';

// Automatically adds auth token
const response = await apiClient.get('/api/users/me');
```

### GraphQL (Apollo Client)

```typescript
import { useQuery } from '@apollo/client';

const { data, loading } = useQuery(GET_CUSTOMERS);
```

### Auto Token Refresh

The app automatically refreshes JWT tokens before expiration:

1. Axios interceptor catches 401 errors
2. Calls `/api/auth/refresh` with refresh token
3. Updates access token in memory
4. Retries original request

## 🎨 Styling

### Tailwind CSS

Utility-first CSS framework with custom configuration:

```tsx
<div className="card card-hover">
  <h2 className="page-title">Dashboard</h2>
  <button className="btn btn-primary">Click me</button>
</div>
```

### Custom Classes (globals.css)

- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`
- `.card`, `.card-hover`
- `.input`, `.input-error`
- `.page-title`, `.page-header`
- `.spinner`

### Dark Mode (Coming Soon)

Dark mode support using Tailwind's `dark:` variant:

```tsx
<div className="bg-white dark:bg-gray-900">
  Content
</div>
```

## 📊 State Management

Redux Toolkit for global state:

```typescript
import { useAppDispatch, useAppSelector } from '@/store';
import { loginUser } from '@/store/slices/authSlice';

// Select state
const { user, isAuthenticated } = useAppSelector(state => state.auth);

// Dispatch actions
const dispatch = useAppDispatch();
await dispatch(loginUser(credentials)).unwrap();
```

## 🧪 Testing (Coming Soon)

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## 📦 Building for Production

```bash
# Build
npm run build

# Analyze bundle size
npm run analyze

# Start production server
npm start
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables for Production

```env
NEXT_PUBLIC_API_URL=https://api.yourbank.com
NEXT_PUBLIC_GRAPHQL_URL=https://api.yourbank.com/graphql
NEXT_PUBLIC_APP_URL=https://cms.yourbank.com
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

## 🔧 Configuration

### API Proxy

Next.js rewrites requests to backend:

```javascript
// next.config.js
async rewrites() {
  return [
    {
      source: '/api/backend/:path*',
      destination: 'http://localhost:8081/api/:path*',
    },
  ];
}
```

### Multi-Tenant Support

Bank ID can be set via:

1. Environment variable: `NEXT_PUBLIC_DEFAULT_BANK_ID`
2. Subdomain detection: `bankname.cms.com`
3. User selection at login

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run type-check` | TypeScript type checking |
| `npm run analyze` | Analyze bundle size |

## 🐛 Troubleshooting

### Module not found errors

```bash
rm -rf node_modules package-lock.json
npm install
```

### API connection failed

1. Check backend is running: `curl http://localhost:8081/actuator/health`
2. Verify CORS settings in backend
3. Check environment variables

### PWA not working

1. Must use HTTPS or localhost
2. Run production build (not dev mode)
3. Check service worker registration in DevTools

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Redux Toolkit](https://redux-toolkit.js.org)
- [Apollo Client](https://www.apollographql.com/docs/react)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

## 📄 License

Copyright © 2025 CMS Banking Platform. All rights reserved.

---

**Built with ❤️ using Next.js, React, and TypeScript**
