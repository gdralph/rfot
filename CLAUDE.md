# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Resource Forecasting & Opportunity Tracker**, a DXC Technology internal tool for managing Salesforce opportunity data, resource allocation, and analytics across service lines (CES, INS, BPS, SEC, ITOC, MW). The application features Excel import capabilities, interactive dashboards, and follows DXC's corporate branding standards with an enhanced V2 UI as the default experience.

Remember this an app that is looking at effort required by service lines to support the opportunity through it's sales stages so dashboards should recognise that is the main persona

## Architecture

**Monorepo Structure:**
- `backend/` - FastAPI + SQLModel + SQLite with Alembic migrations
- `frontend/` - React 19 + TypeScript + Vite + TailwindCSS + TanStack Query + Recharts

**Key Architectural Patterns:**
- **Backend**: Uses SQLModel for type-safe ORM with Pydantic validation, background task processing for Excel imports, and structured logging with structlog
- **Frontend**: TanStack Query for server state management, custom hooks for API interactions, comprehensive DXC-branded component system with custom Tailwind utilities, Recharts for data visualization, advanced configuration management UI, enhanced V2 UI components as default with legacy V1 fallback
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
python3 seed_data.py  # Creates categories and internal service mappings

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
python3 seed_data.py                      # Initialize configuration data and internal service mappings
python3 seed_service_line_data.py         # Initialize MW/ITOC service line templates
python3 seed_internal_service_mappings.py # Manage internal service mappings (verify/reset)
python3 add_sample_data.py                # Add sample opportunities

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
- **Active Charts**: ResourceForecastChart, ServiceLineAnalysisChart, StageResourceTimelineChart, TCVServiceLineTimelineChart
- **Archive Components**: Legacy chart components moved to `components/charts/archive/` for reference
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
- **Configuration UI**: Advanced admin interface with tabs for categories, service line resource planning (MW/ITOC), service line allocation, and timeline generation
- **Build System**: Vite 7.0+ with TypeScript 5.8+ compilation, production builds generate optimized bundles

### DXC Branding Integration
- **Colors**: Complete DXC color palette integrated into TailwindCSS config with primary purple (#5F249F), accent colors (teal, blue, green, orange, gold), and neutral grays
- **Components**: Comprehensive custom Tailwind utility classes (`.btn-primary`, `.btn-secondary`, `.card`, `.table`, `.badge`) with full DXC styling
- **Typography**: Arial font family with DXC-specific size scales (`text-dxc-slide`, `text-dxc-subtitle`, `text-dxc-body`) and responsive scaling
- **Icons**: Lucide React icon system for consistent UI elements
- **Charts**: Custom DXC color schemes for Recharts components with responsive design
- **Design**: Flat design principles, no 3D effects, professional enterprise appearance with consistent spacing

## Data Model Key Concepts

**Core Entities:**
- **Opportunity**: Main business record with stages (01: Understand Customer → 02: Validate Opportunity → 03: Qualify Opportunity → 04A: Develop Solution → 04B: Propose Solution → 05A: Negotiate → 05B: Award & Close → 06: Deploy & Extend)
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
- **Custom Hooks**: Domain-specific hooks (`useOpportunities`, `useResourceTimeline`) encapsulate query logic
- **Optimistic Updates**: Opportunity edits update cache immediately
- **Error Boundaries**: Global error handling for API failures

## Configuration Management & Troubleshooting

### Internal Service Mappings
Internal service mappings determine which opportunity line items are counted for offering threshold calculations. Each service line (MW, ITOC) has a configured list of internal service values that should be included in FTE multiplier calculations.

**Default Mappings:**
- **MW (Modern Workplace)**: "Modern Workplace", "MW", "Workplace Services", "Digital Employee Experience", "Collaboration", "Endpoint Services"
- **ITOC (Infrastructure & Cloud)**: "Infrastructure & Cloud", "ITOC", "Cloud Services", "Infrastructure Services", "Data Center Services", "Network Services", "Platform Services"

**Troubleshooting Commands:**
```bash
# Verify all default mappings exist
python3 seed_internal_service_mappings.py verify

# Create any missing default mappings
python3 seed_internal_service_mappings.py

# Reset all mappings to defaults (removes custom mappings)
python3 seed_internal_service_mappings.py reset
```

**Common Issues:**
- **FTE multipliers not working**: Check that opportunity line items have `internal_service` values that match the configured mappings
- **Missing default mappings**: Run the verify command to check, then run seed script to create missing mappings
- **Custom mappings lost**: Use the reset command to restore defaults, then re-add custom mappings through the UI

**API Management:**
- View mappings: `GET /api/config/service-line-internal-service-mappings`
- Add mapping: `POST /api/config/service-line-internal-service-mappings`
- Delete mapping: `DELETE /api/config/service-line-internal-service-mappings/{id}`

## Development Environment

- Backend runs on port 8000, frontend on 5173
- Interactive API docs available at `/docs`
- Hot reloading enabled for both backend and frontend
- Pre-commit hooks enforce code quality standards
- Environment variables managed via `.env` files

## Critical Technical Patterns & Architecture Details

### Resource Timeline Calculation System
The core business logic revolves around resource timeline calculations:
- **`_is_opportunity_eligible_for_generation()`** function in `app/api/resources.py` determines eligibility based on TCV, decision date, category mapping, and service line configuration
- **Service Lines**: Only MW (Modern Workplace) and ITOC (Infrastructure & Cloud) have full resource planning templates
- **Category Mapping**: TCV amounts map to categories (Sub $5M, Cat C, Cat B, Cat A) via `OpportunityCategory` database records
- **Timeline Generation**: Uses `ServiceLineStageEffort` templates to calculate FTE requirements across sales stages
- **Offering-Based Multipliers**: `calculate_offering_multiplier()` counts unique offerings filtered by internal service mappings and applies threshold-based FTE multipliers
- **Internal Service Filtering**: Only opportunity line items with `internal_service` values mapped to the service line are counted for offering threshold calculations
- **Missing Timeline Calculation**: `_calculate_missing_timelines_count()` identifies opportunities eligible for timeline generation but lacking timeline data

### Database Architecture Patterns
- **SQLModel + Pydantic**: All models use modern Pydantic v2 field validators (`@field_validator` with `@classmethod`)
- **Configuration-Driven**: Categories and stage efforts are database-driven, not hardcoded
- **Resource Timeline**: `OpportunityResourceTimeline` stores calculated FTE requirements by service line and stage
- **Background Processing**: Excel imports run as background tasks with progress tracking via `ImportTask` model

### Frontend Architecture Specifics
- **TanStack Query**: All server state managed through query keys pattern (`OPPORTUNITY_KEYS`, `RESOURCE_TIMELINE_KEYS`)
- **Type Safety**: Uses `.js` extensions in import paths for TypeScript compatibility
- **Chart Integration**: Recharts components with DXC color schemes (`DXC_COLORS` array)
- **Error Handling**: Uses `ErrorBoundary` component with `import.meta.env.DEV` for development detection
- **State Management**: Custom hooks encapsulate all API interactions (`useOpportunities`, `useResourceTimeline`)

### Key Business Logic Flows
1. **Excel Import**: File upload → Background processing → Progress polling → Database upsert → UI refresh
2. **Resource Calculation**: Opportunity data → Eligibility check → Category mapping → Service line template lookup → Timeline generation
3. **Dashboard Updates**: TanStack Query invalidation → Automatic refetch → Real-time UI updates

### Code Quality Standards
- **Logging**: Uses `structlog` for structured logging, no `print()` statements in production code (debug prints commented out with `#`)
- **Frontend Debug**: All `console.log`, `console.warn`, `console.debug` statements commented out (using `//`), `console.error` preserved for error handling
- **Error Handling**: Specific error messages with `raise ... from e` pattern, avoid generic `raise e`
- **Type Safety**: Modern Pydantic validators, proper TypeScript types, `any` type used sparingly for complex chart data
- **Build Quality**: Frontend builds successfully with TypeScript strict mode, unused variables prefixed with `_`
- **Database Migrations**: Alembic migrations manage schema changes, use `python3 -m alembic` prefix

## UI Architecture: V2 Enhanced as Default

**IMPORTANT**: The application now uses **V2 Enhanced UI as the default experience** with legacy V1 pages available for fallback during transition.

### Current UI System (December 2024)
- **Default Experience**: V2 Enhanced UI serves all main routes (`/`, `/opportunities`, `/config`, etc.)
- **Legacy Fallback**: Original V1 pages accessible via `/v1/` prefix routes for temporary compatibility
- **Backward Compatibility**: `/v2/` prefix routes still work for existing bookmarks
- **UI Switcher**: Bottom-right toggle allows switching between current (V2) and legacy (V1) versions

### V2 Enhanced UI Design Principles (Now Default)
- **Condensed UI**: Higher information density with compact layouts and smaller text
- **Enhanced Components**: Specialized MetricCard, CompactTable, and StatusIndicator components
- **Grid-based Metrics**: Standardized grid layouts (grid-metrics-4, grid-metrics-6) for consistent metric displays
- **Feature Parity**: Maintains 100% functionality of original pages while improving usability
- **Data Density**: Optimized for business users who need to see more information quickly

### V2 Component Architecture (Current Default)
- **Enhanced UI Components**: Located in `components/ui/` directory
  - `MetricCard`: Condensed metric display with icons, trends, and subtitles
  - `CompactTable`: Data-dense table with sorting, filtering, and row click handling
  - `StatusIndicator`: Compact status badges with color coding
- **V2 Pages**: Located in `pages/` directory with "V2" suffix (but serve main routes)
  - `DashboardV2`: Condensed dashboard with metric cards and compact charts → serves `/`
  - `OpportunitiesV2`: Enhanced opportunities list with advanced filtering → serves `/opportunities`
  - `OpportunityDetailV2`: Comprehensive detail view with tabbed resource analysis → serves `/opportunity/:id`
  - `ConfigV2`: Streamlined configuration interface with card-based navigation → serves `/config`
  - `ReportsV2`: Condensed report generation with enhanced export options → serves `/reports`
  - `ImportV2`: Compact data import interface with enhanced file upload → serves `/import`

### Current Routing Architecture
**Main Routes (V2 Enhanced - Default):**
- `/` → DashboardV2 (enhanced dashboard)
- `/opportunities` → OpportunitiesV2 (enhanced opportunities list)
- `/opportunity/:id` → OpportunityDetailV2 (enhanced detail view)
- `/config` → ConfigV2 (enhanced configuration)
- `/reports` → ReportsV2 (enhanced reports)
- `/import` → ImportV2 (enhanced import)

**Legacy Routes (V1 Original - Fallback):**
- `/v1/dashboard` → Dashboard (original)
- `/v1/opportunities` → Opportunities (original)
- `/v1/opportunity/:id` → OpportunityDetail (original)
- `/v1/config` → Config (original)
- `/v1/reports` → Reports (original)
- `/v1/import` → Import (original)

**Backward Compatibility Routes:**
- `/v2/*` routes still work and serve the same V2 components

### UI Switcher Behavior
- **Current UI**: Shows when on main routes (V2), allows switching to legacy V1
- **Legacy V1**: Shows when on `/v1/` routes, allows switching back to current (V2)
- **Navigation**: Main navigation bar always points to current routes (V2)
- **Future**: UI switcher can be removed once V2 is fully validated

### Development Guidelines for V2 (Current Default)
1. **All new features** should be built for V2 components first
2. **Bug fixes** should prioritize V2 components
3. **Testing** should focus on V2 user experience as primary
4. **Legacy V1** components are for fallback only, not active development
5. **Feature Parity**: Any changes to V1 should be reflected in V2

### V2 Styling Guidelines (Current Standard)
- **Compact Headers**: Smaller text sizes, reduced padding, inline status indicators
- **Dense Tables**: Smaller font sizes, reduced row height, hover effects for interactivity
- **Metric Cards**: Consistent icon placement, trend indicators, color-coded values
- **Responsive Design**: Grid layouts that adapt to screen size with appropriate breakpoints
- **DXC Branding**: Maintain color palette and typography while increasing density

### Migration Status
- ✅ **Complete**: V2 is now the default experience
- ✅ **Navigation**: All main navigation serves V2 pages
- ✅ **URLs**: Existing bookmarks work the same, just serve enhanced UI
- ✅ **Fallback**: Legacy V1 pages remain available during transition
- 🔄 **Future**: Can remove V1 pages and UI switcher when V2 is fully validated

## Memories
- **UI Architecture**: V2 Enhanced UI is now the DEFAULT experience (December 2024)
  - Main routes (`/`, `/opportunities`, etc.) serve V2 components
  - Legacy V1 available at `/v1/` prefix routes during transition
  - UI Switcher allows temporary access to legacy pages
- **Removed Features**: Forecast pages (both V1 and V2) completely removed from application
- **Database**: Always use opportunitycategory for category definitions and servicelinestageeffort for resource/FTE calculations
- **Resource Timelines**: Check eligibility first using `_is_opportunity_eligible_for_generation()`
- **Code Quality**: Frontend builds cleanly with TypeScript strict mode, unused variables prefixed with `_`, debug statements commented out
- **Backend**: Uses modern FastAPI lifespan events, not deprecated `@app.on_event` handlers
- **Components**: Chart components reorganized with active charts in main directory, legacy in archive/ folder
- **Development Focus**: All new development should target V2 components as they are now the primary user experience
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.