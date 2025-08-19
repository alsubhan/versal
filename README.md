# Versal - Warehouse Management System

A comprehensive warehouse management system built with modern web technologies, designed for businesses to manage their warehouse operations, inventory, sales, purchases, and reporting needs.

## 🚀 Features

### Core Inventory Management
- **Product Management**: Add, edit, and organize products with categories, units, and barcodes
- **Stock Tracking**: Real-time stock level monitoring across multiple locations
- **Inventory Movements**: Track stock in/out movements with detailed transaction history
- **Location Management**: Manage multiple warehouse locations and storage areas

### Sales & Purchasing
- **Wholesale Orders**: Create and manage wholesale sales orders
- **Wholesale Billing**: Generate invoices and manage billing processes
- **Purchase Orders**: Manage supplier purchase orders
- **Goods Received Notes (GRN)**: Track received goods and update inventory
- **Credit Notes**: Handle returns and credit note processing

### Business Management
- **Customer Management**: Maintain customer database with contact information
- **Supplier Management**: Manage supplier relationships and information
- **Tax Management**: Configure and apply tax rates
- **Category Management**: Organize products with hierarchical categories
- **Unit Management**: Define and manage product units of measurement

### Reporting & Analytics
- **Inventory Reports**: Stock level reports and inventory valuation
- **Purchase Reports**: Supplier purchase analysis
- **Sales Reports**: Revenue and sales performance tracking
- **Date Range Filtering**: Customizable report periods

### User Management & Security
- **Role-Based Access Control**: Granular permissions system
- **User Management**: Admin user creation and management
- **Authentication**: Secure JWT-based authentication via Supabase
- **Settings Management**: System and user-specific settings

### Additional Features
- **Barcode Management**: Generate and manage product barcodes
- **Backup System**: Data backup and restoration capabilities
- **Multi-Currency Support**: International currency handling
- **Responsive Design**: Mobile-friendly interface

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **React Router** - Client-side routing
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **React Hook Form** - Form handling with validation
- **Zod** - Schema validation
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern UI components
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icons
- **Recharts** - Data visualization
- **React To Print** - Print functionality

### Backend
- **FastAPI** - Modern Python web framework
- **Supabase** - Backend-as-a-Service (Database, Auth, Storage)
- **PostgreSQL** - Primary database (via Supabase)
- **Python-Jose** - JWT token handling
- **Pydantic** - Data validation
- **Uvicorn** - ASGI server

### Database
- **Supabase PostgreSQL** - Primary database
- **Row Level Security (RLS)** - Database-level security
- **Real-time subscriptions** - Live data updates

## 📁 Project Structure

```
versal/
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── stores/          # Zustand state stores
│   │   ├── types/           # TypeScript type definitions
│   │   ├── lib/             # Utility functions
│   │   └── integrations/    # External service integrations
│   └── public/              # Static assets
├── backend/                 # FastAPI Python backend
│   ├── main.py             # Main API application
│   ├── requirements.txt    # Python dependencies
│   ├── tests/              # Backend tests
│   └── venv/               # Python virtual environment
└── supabase/               # Database migrations and config
    ├── migrations/         # SQL migration files
    ├── scripts/           # Development and maintenance scripts
    ├── docs/              # Database documentation and guides
    └── config.toml         # Supabase configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Supabase account and project

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the frontend directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_URL=http://localhost:8000
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   Create a `.env` file in the backend directory:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   ```

5. **Start the API server**:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Database Setup

1. **Set up Supabase project**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Get your project URL and API keys

2. **Run migrations**:
   ```bash
   supabase db push
   ```

3. **Seed initial data** (optional):
   ```bash
   supabase db reset
   ```

## 🔧 Configuration

### Environment Variables

#### Frontend (.env)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:8000
```

#### Backend (.env)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
# Optional: Enable in-app issue reporting to GitHub
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repo_name
GITHUB_TOKEN=github_pat_with_repo_scope
GITHUB_DEFAULT_LABELS=bug,from-app
```

### Supabase Configuration

The project uses Supabase for:
- **Authentication**: JWT-based user authentication
- **Database**: PostgreSQL with Row Level Security
- **Real-time**: Live data updates
- **Storage**: File storage for documents and images

## 📊 API Endpoints

The backend provides RESTful APIs for:

- **Products**: CRUD operations for product management
- **Inventory**: Stock levels, movements, and transactions
- **Customers**: Customer database management
- **Suppliers**: Supplier information management
- **Sales**: Wholesale orders and billing
- **Purchases**: Purchase orders and GRNs
- **Users**: User management and roles
- **Settings**: System and user settings
- **Reports**: Analytics and reporting data

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions system
- **Row Level Security**: Database-level security policies
- **CORS Protection**: Cross-origin request security
- **Input Validation**: Comprehensive data validation

## 🧪 Development

### Available Scripts

#### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

#### Backend
```bash
uvicorn main:app --reload  # Start development server
```

### Code Quality

- **TypeScript**: Type-safe development
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Pydantic**: Data validation

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🤝 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code examples

---

**Versal** - Streamlining inventory management for modern businesses.
