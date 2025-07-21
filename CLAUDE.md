# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Resource Forecasting & Opportunity Tracker**, a DXC Technology internal tool for managing Salesforce opportunity data, resource allocation, and forecasting across service lines (CES, INS, BPS, SEC, ITOC, MW). The application features Excel import capabilities, interactive dashboards, and follows DXC's corporate branding standards.

Remember this an app that is looking at effort required by service lines to support the opportunity through it's sales stages so dashboards should recognise that is the main persona

## Architecture

**Monorepo Structure:**
- `backend/` - FastAPI + SQLModel + SQLite with Alembic migrations
- `frontend/` - React 19 + TypeScript + Vite + TailwindCSS + TanStack Query + Recharts

**Key Architectural Patterns:**
- **Backend**: Uses SQLModel for type-safe ORM with Pydantic validation, background task processing for Excel imports, and structured logging with structlog
- **Frontend**: TanStack Query for server state management, custom hooks for API interactions, comprehensive DXC-branded component system with custom Tailwind utilities, Recharts for data visualization, advanced configuration management UI
- **Data Flow**: Excel files → Background processing → SQLite → REST API → React Query → UI components

## Initial Setup Instructions

### Prerequisites
- Python 3.9+ 
- Node.js 16+
- Git

### Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up database (REQUIRED for first run)
python3 -m alembic upgrade head  # Run migrations to create database schema

# Initialize configuration data (REQUIRED for first run)
python3 seed_data.py  # Creates categories, effort estimates, and SME allocation rules

# Optional: Add sample opportunity data for testing
python3 add_sample_data.py  # Creates sample opportunities with line items

# Start development server
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure API endpoint (optional, defaults to http://localhost:8000)
# Create .env.local file if you need a different API URL:
# echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local

# Start development server
npm run dev  # Runs on http://localhost:5173
```

## Development Commands

### Backend Commands
```bash
cd backend

# Start development server
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Database migrations
python3 -m alembic revision --autogenerate -m "Description"
python3 -m alembic upgrade head

# Data initialization
python3 seed_data.py              # Initialize configuration data
python3 seed_service_line_data.py # Initialize MW/ITOC service line templates
python3 add_sample_data.py        # Add sample opportunities

# Testing
pytest                    # Run all tests
pytest tests/test_main.py # Run specific test file
pytest -v                # Verbose output

# Code quality (with pre-commit hooks installed)
black .                   # Format code
isort .                   # Sort imports
flake8 .                 # Lint code
```

### Frontend Commands
```bash
cd frontend

# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build           # Production build
npm run preview         # Preview production build

# Code quality
npm run lint            # ESLint (using flat config format)
```

### Technology Versions
- **React**: 19.1.0 with React DOM 19.1.0
- **TypeScript**: 5.8.3
- **Vite**: 7.0.4 with enhanced development features
- **TailwindCSS**: Latest with custom DXC configuration
- **Recharts**: Latest for data visualization
- **Lucide React**: 0.525.0 for icons

## Key Components and Patterns

### Configuration Management System
- **CategoriesTab** (`components/config/CategoriesTab.tsx`): Full CRUD interface for opportunity categories with TCV ranges
- **ServiceLineResourceTab** (`components/config/ServiceLineResourceTab.tsx`): Matrix-based resource planning for MW (Modern Workplace) and ITOC (Infrastructure & Cloud) service lines with duration and FTE configuration by category and sales stage
- **ServiceLineAllocationTab** (`components/config/ServiceLineAllocationTab.tsx`): Advanced resource allocation interface with integrated charts

### Data Visualization Components
- **Recharts Integration**: Bar charts, pie charts, and responsive containers with DXC color schemes
- **Custom Chart Styling**: DXC purple-first color palette with accent colors for data series
- **Interactive Dashboards**: Real-time data updates with TanStack Query integration

### Backend Architecture
- **Models** (`app/models/`): SQLModel classes with Pydantic validation
  - `opportunity.py` - Core business entities (Opportunity, OpportunityLineItem)
  - `config.py` - Configuration entities (Categories, ServiceLineStageEffort, legacy StageEffortEstimate, SMEAllocationRule)
- **API Routes** (`app/api/`): FastAPI routers grouped by domain
- **Services** (`app/services/`): Business logic, especially `excel_import.py` for background processing
- **Database**: SQLite with Alembic migrations, models use relationships for data integrity

### Frontend Architecture
- **State Management**: TanStack Query handles all server state, custom hooks in `hooks/` encapsulate API logic
- **Components**: Reusable UI components in `components/`, page-level components in `pages/`, sophisticated configuration management tabs in `components/config/`
- **API Client**: Centralized API client in `services/api.ts` with comprehensive error handling
- **Types**: Comprehensive TypeScript definitions in `types/index.ts` with constants for sales stages, service lines, DXC colors, and ordering systems
- **Visualization**: Recharts integration with custom DXC-themed charts and responsive containers
- **Configuration UI**: Advanced admin interface with tabs for categories, SLA resource planning (MW/ITOC), and service line allocation

### DXC Branding Integration
- **Colors**: Complete DXC color palette integrated into TailwindCSS config with primary purple (#5F249F), accent colors (teal, blue, green, orange, gold), and neutral grays
- **Components**: Comprehensive custom Tailwind utility classes (`.btn-primary`, `.btn-secondary`, `.card`, `.table`, `.badge`) with full DXC styling
- **Typography**: Arial font family with DXC-specific size scales (`text-dxc-slide`, `text-dxc-subtitle`, `text-dxc-body`) and responsive scaling
- **Icons**: Lucide React icon system for consistent UI elements
- **Charts**: Custom DXC color schemes for Recharts components with responsive design
- **Design**: Flat design principles, no 3D effects, professional enterprise appearance with consistent spacing

## Data Model Key Concepts

**Core Entities:**
- **Opportunity**: Main business record with stages (SS-01 through SS-06: Understand Customer → Validate → Qualify → Develop/Propose → Negotiate/Close → Deploy/Extend)
- **OpportunityLineItem**: Service line revenue breakdown (CES, INS, BPS, SEC, ITOC, MW)
- **Categories**: TCV-based auto-categorization (Sub $5M, Cat C, Cat B, Cat A)
- **ServiceLineStageEffort**: MW/ITOC-specific resource templates with duration, FTE, and calculated effort for each category-stage combination

**Service Lines** are central to the application - all forecasting and resource allocation is organized around these six DXC service areas.

## Import Processing Flow

Excel import uses background tasks with progress tracking:
1. File upload → temporary storage
2. Background task processes with pandas/openpyxl
3. Real-time progress updates via polling API
4. Validation, deduplication, and database upserts
5. Error collection and reporting

## API Design Patterns

- **Filtering**: Query parameters for search/filter operations
- **Relationships**: Related data accessible via sub-endpoints (e.g., `/opportunities/{id}/line-items`)
- **Background Tasks**: Import operations return task IDs for status polling
- **Error Handling**: Consistent error responses with structured logging

## Frontend State Management

- **TanStack Query**: All server state, automatic caching, background updates
- **Custom Hooks**: Domain-specific hooks (`useOpportunities`, `useForecasts`) encapsulate query logic
- **Optimistic Updates**: Opportunity edits update cache immediately
- **Error Boundaries**: Global error handling for API failures

## Development Environment

- Backend runs on port 8000, frontend on 5173
- Interactive API docs available at `/docs`
- Hot reloading enabled for both backend and frontend
- Pre-commit hooks enforce code quality standards
- Environment variables managed via `.env` files