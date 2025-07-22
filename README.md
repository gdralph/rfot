# Resource Forecasting & Opportunity Tracker (RFOT)

A comprehensive DXC Technology internal tool for managing Salesforce opportunity data, resource allocation, and forecasting across service lines. Built with modern web technologies and designed for enterprise-scale resource planning and opportunity tracking.

## 🚀 Key Features

### Core Functionality
- **Excel Import Processing** - Bulk import Salesforce opportunity data with real-time progress tracking
- **Resource Timeline Calculation** - Automated FTE (Full-Time Equivalent) forecasting based on opportunity stages and service lines
- **Interactive Dashboards** - Real-time visualization of opportunity pipelines, resource allocation, and forecasting metrics
- **Service Line Management** - Dedicated resource planning for MW (Modern Workplace) and ITOC (Infrastructure & Cloud) service lines
- **Category-Based Forecasting** - TCV-driven opportunity categorization (Sub $5M, Cat C, Cat B, Cat A)

### Advanced Features
- **Background Task Processing** - Asynchronous Excel imports with progress tracking
- **Configuration Management** - Dynamic category and stage effort configuration
- **Multi-Service Line Support** - CES, INS, BPS, SEC, ITOC, MW service line tracking
- **DXC Corporate Branding** - Complete DXC color palette and design system integration
- **Real-Time Updates** - Live dashboard updates with TanStack Query state management

## 🏗️ Technology Stack

### Backend
- **FastAPI** - Modern, fast web framework with automatic API documentation
- **SQLModel** - Type-safe ORM with Pydantic v2 validation
- **SQLite** - Lightweight database with Alembic migrations
- **Structlog** - Structured logging for better debugging and monitoring
- **Background Tasks** - Async processing with pandas/openpyxl for Excel handling

### Frontend
- **React 19** - Latest React with concurrent features
- **TypeScript 5.8.3** - Type safety and enhanced developer experience
- **Vite 7.0.4** - Lightning-fast build tool and development server
- **TailwindCSS** - Utility-first CSS with custom DXC theming
- **TanStack Query** - Powerful data synchronization for React
- **Recharts** - Composable charting library with custom DXC themes

## 📋 Prerequisites

- **Python 3.9+** - Backend development and execution
- **Node.js 16+** - Frontend development and building
- **Git** - Version control and repository management

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Set up database (REQUIRED for first run)
python3 -m alembic upgrade head

# Initialize configuration data (REQUIRED)
python3 seed_data.py

# Initialize MW/ITOC resource templates (REQUIRED)
python3 seed_service_line_data.py

# Optional: Add sample data for testing
python3 add_sample_data.py

# Start development server
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
cd frontend

# Install Node.js dependencies
npm install

# Start development server
npm run dev
```

### 3. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🛠️ Development Commands

### Backend Commands

```bash
# Development server
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Database operations
python3 -m alembic revision --autogenerate -m "Description"
python3 -m alembic upgrade head

# Data management
python3 seed_data.py              # Initialize categories and configuration
python3 seed_service_line_data.py # Initialize MW/ITOC resource templates
python3 add_sample_data.py        # Add sample opportunities

# Testing and quality
pytest                    # Run all tests
pytest -v                # Verbose test output
black .                   # Code formatting
isort .                   # Import sorting
flake8 .                 # Code linting
```

### Frontend Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Production build
npm run preview         # Preview production build
npm run lint            # ESLint code checking
```

## 📊 Architecture Overview

### Monorepo Structure
```
rfot/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLModel database models
│   │   ├── api/            # API route handlers by domain
│   │   ├── services/       # Business logic and Excel processing
│   │   ├── main.py         # FastAPI application with lifespan events
│   │   └── config.py       # Configuration with Pydantic settings
│   ├── alembic/            # Database migrations
│   ├── tests/              # Pytest test suite
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── config/     # Configuration management tabs
│   │   │   └── charts/     # Data visualization components
│   │   ├── pages/          # Page-level components
│   │   ├── hooks/          # Custom React hooks for API integration
│   │   ├── services/       # API client with error handling
│   │   ├── types/          # TypeScript definitions and constants
│   │   └── utils/          # Utility functions
│   └── package.json        # Node.js dependencies
├── CLAUDE.md               # Claude Code instructions
└── README.md               # This file
```

### Key Architectural Patterns

- **Configuration-Driven**: Categories and stage efforts stored in database, not hardcoded
- **Type-Safe ORM**: SQLModel with Pydantic v2 field validators throughout
- **Query-First Frontend**: TanStack Query manages all server state with custom hooks
- **Component Architecture**: Reusable UI components with comprehensive DXC styling
- **Background Processing**: Excel imports handled asynchronously with progress tracking

## 📈 Core Business Logic

### Sales Stages Flow
```
01: Understand Customer → 02: Validate Opportunity → 03: Qualify Opportunity 
→ 04A: Develop Solution → 04B: Propose Solution → 05A: Negotiate 
→ 05B: Award & Close → 06: Deploy & Extend
```

### Service Lines
- **CES** - Cloud Engineering Services
- **INS** - Infrastructure Services  
- **BPS** - Business Process Services
- **SEC** - Security Services
- **ITOC** - Infrastructure & Cloud (with detailed resource planning)
- **MW** - Modern Workplace (with detailed resource planning)

### Resource Timeline Calculation
1. **Eligibility Check** - Verify TCV, decision date, and configuration using `_is_opportunity_eligible_for_generation()`
2. **Category Mapping** - Map TCV to opportunity categories via database lookup
3. **Service Line Identification** - Determine MW/ITOC participation based on revenue data
4. **Template Application** - Apply `ServiceLineStageEffort` templates for FTE calculation
5. **Timeline Generation** - Create `OpportunityResourceTimeline` records with calculated effort

## 📊 Data Model

### Core Entities

- **Opportunity** - Main business records with sales stages, TCV data, and service line revenue
- **OpportunityLineItem** - Detailed service line revenue breakdown
- **OpportunityCategory** - TCV-based categorization rules (Sub $5M, Cat C, Cat B, Cat A)
- **ServiceLineStageEffort** - Resource templates for MW/ITOC planning with duration and FTE
- **OpportunityResourceTimeline** - Calculated FTE requirements by service line and stage

### Key Workflows

#### Excel Import Process
1. **File Upload** → Background processing → Progress tracking → Validation → Database upsert

#### Resource Timeline Generation
1. **Eligibility Check** → Category mapping → Service line templates → Timeline calculation

#### Dashboard Updates
1. **Query Invalidation** → Background refetch → Real-time UI updates

## 🎨 DXC Branding Integration

### Color System
- **Primary**: DXC Bright Purple (#5F249F)
- **Accent Colors**: Teal (#14B8A6), Blue (#3B82F6), Green (#10B981), Orange (#F59E0B), Gold (#EAB308)
- **Charts**: Custom DXC color schemes for Recharts components

### Design System
- **Typography**: Arial font family with DXC-specific size scales
- **Components**: Custom Tailwind utilities (`.btn-primary`, `.card`, `.table`, `.badge`)
- **Icons**: Lucide React icon system for consistency
- **Layout**: Flat design principles, professional enterprise appearance

## 🧪 Testing

### Backend Testing
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_main.py

# Verbose output
pytest -v
```

### Frontend Testing
```bash
# TypeScript compilation check
npm run build

# ESLint code checking
npm run lint
```

## 📚 API Documentation

Interactive API documentation is automatically generated and available at `/docs` when the backend server is running.

### Key Endpoints

**Opportunities:**
- `GET /api/opportunities/` - List with filtering support
- `GET /api/opportunities/{id}` - Detailed opportunity data
- `PUT /api/opportunities/{id}` - Update opportunity fields

**Resource Planning:**
- `GET /api/resources/portfolio-forecast` - Portfolio-wide resource forecasting
- `POST /api/resources/calculate-timeline/{id}` - Generate resource timeline
- `GET /api/resources/timeline-data-bounds` - Data boundary information

**Configuration:**
- `GET/POST /api/config/categories` - Manage opportunity categories
- `GET/POST /api/config/service-line-efforts` - Manage MW/ITOC resource templates

**Import:**
- `POST /api/import/excel` - Background Excel processing
- `GET /api/import/status/{task_id}` - Real-time progress tracking

## 🔧 Configuration

### Backend Configuration
- **Database**: SQLite with configurable URL
- **CORS**: Configured for development ports (5173, 3000)
- **Logging**: Structured logging with configurable levels
- **Environment**: Settings managed via Pydantic with `.env` support

### Frontend Configuration
- **API Endpoint**: Set via `VITE_API_BASE_URL` environment variable
- **Development**: Defaults to `http://localhost:8000`
- **Build**: Optimized production builds with code splitting

## 🚀 Production Deployment

### Backend
```bash
# Production server with multiple workers
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend
```bash
# Production build
npm run build

# Generated files in dist/ directory ready for static hosting
```

### Database Considerations
- Current: SQLite for development and single-user deployments
- Production: Consider PostgreSQL for multi-user environments
- Migrations: Fully managed via Alembic

## 🏢 Business Context

This tool addresses DXC Technology's specific needs for:

- **Resource Forecasting** - Predict FTE requirements across service lines during sales processes
- **Opportunity Pipeline Management** - Track opportunities with accurate effort estimation
- **Service Line Planning** - Allocate MW and ITOC resources based on opportunity stages
- **Data Integration** - Import Salesforce data efficiently with validation
- **Executive Reporting** - Visualize resource demand through interactive dashboards

The application recognizes that the main persona is **resource planning focused on effort required by service lines** to support opportunities through their sales stages.

## 📝 Support & Documentation

- **Interactive API Docs**: Available at `/docs` endpoint when backend is running
- **Code Architecture**: Detailed technical patterns documented in `CLAUDE.md`
- **DXC Internal**: For internal DXC Technology use only

---

*Built with ❤️ for DXC Technology resource planning and opportunity management.*

**Version**: 1.0.0 | **Last Updated**: January 2025