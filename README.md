# Resource Forecasting & Opportunity Tracker

A DXC Technology internal tool for resource forecasting and tracking Salesforce opportunities with Excel import capabilities, forecasting dashboards, and service line allocation tracking.

## Recent Updates (July 21, 2025)

- **Initial Project Setup**: Complete monorepo structure with FastAPI backend and React frontend
- **Database Initialization**: Added `seed_data.py` script for required configuration data
- **Sample Data**: Added `add_sample_data.py` script for testing with realistic opportunities
- **Setup Documentation**: Updated setup instructions to include database initialization steps
- **CORS Configuration**: Configured to support both development ports (3000 and 5173)

## Overview

This application provides a comprehensive solution for managing opportunity data, resource allocation, and forecasting across multiple service lines. Built with modern web technologies and following DXC's brand guidelines.

### Key Features

- **Excel Import**: Import opportunity data and line items from Excel files with background processing
- **Opportunity Management**: View, search, filter, and edit opportunities with real-time updates
- **Forecasting Dashboards**: Interactive charts showing stage breakdown, category analysis, and service line allocation
- **Service Line Tracking**: Revenue breakdown across CES, INS, BPS, SEC, ITOC, and MW service lines
- **DXC Branded UI**: Professional interface following DXC's color palette and design standards
- **Advanced Configuration Management**: Comprehensive admin interface with tabbed design for categories, effort estimates, SME allocation rules, and service line allocation with integrated charts

## Architecture

### Technology Stack

**Backend:**
- FastAPI with SQLModel for type-safe ORM
- SQLite database with Alembic migrations
- pandas & openpyxl for Excel processing
- Background tasks for file imports
- Structured logging with structlog

**Frontend:**
- React 19.1.0 with TypeScript 5.8.3
- Vite 7.0.4 for fast development and building
- TailwindCSS with comprehensive DXC color palette and custom utilities
- TanStack Query for API state management
- Recharts for interactive data visualization with DXC styling
- Lucide React 0.525.0 for consistent iconography
- React Router for navigation

## Project Structure

```
rfot/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLModel database models
│   │   ├── api/            # API route handlers
│   │   ├── services/       # Business logic services
│   │   ├── main.py         # FastAPI application
│   │   └── config.py       # Configuration settings
│   ├── alembic/            # Database migrations
│   ├── tests/              # Backend tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── config/     # Configuration management tabs
│   │   │   └── ...         # Other components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API client and utilities
│   │   ├── types/          # TypeScript type definitions with constants
│   │   └── styles/         # Custom CSS and Tailwind config
│   └── package.json        # Node.js dependencies
├── database.db             # SQLite database (created on first run)
├── dxc_style_guide.md      # DXC branding guidelines
├── functional_spec_resource_app.md  # Functional specification
├── technical_spec_resource_app.md   # Technical specification
├── DEVELOPMENT_PLAN.md     # Development tracking
├── Opportunities.xlsx      # Sample data file
├── Opportunity Line Items.xlsx  # Sample line items
└── README.md               # This file
```

## Setup Instructions

### Prerequisites

- Python 3.9+
- Node.js 16+
- npm or yarn

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run database migrations (REQUIRED for first run):**
   ```bash
   python3 -m alembic upgrade head
   ```

4. **Initialize configuration data (REQUIRED for first run):**
   ```bash
   python3 seed_data.py
   ```
   This creates necessary configuration data including:
   - Opportunity categories (Sub $5M, Cat C, Cat B, Cat A)
   - Stage effort estimates for each category
   - SME allocation rules for service lines

5. **Optional: Add sample data for testing:**
   ```bash
   python3 add_sample_data.py
   ```
   This creates sample opportunities and line items for testing the application.

6. **Start the backend server:**
   ```bash
   python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`
   
   Interactive API docs: `http://localhost:8000/docs`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure API endpoint (optional):**
   By default, the frontend connects to `http://localhost:8000`. If your backend runs on a different URL, create a `.env.local` file:
   ```bash
   echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

### Quick Start (Both Services)

For convenience, after initial setup, you can start both services:

**Terminal 1 - Backend:**
```bash
cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend && npm run dev
```

## Usage

### 1. Dashboard
- View summary metrics and charts
- Monitor opportunities by stage and category
- Analyze service line revenue distribution

### 2. Opportunities Management
- Search and filter opportunities
- View detailed opportunity information
- Edit opportunity assignments and status
- Track service line allocations

### 3. Excel Import
- Import opportunities from Salesforce Excel exports
- Import opportunity line items for service line breakdown
- Monitor import progress with real-time updates
- Handle errors and validation issues

### 4. Forecasting
- Generate forecasts based on stage and category rules
- Track SME allocation by service line
- Monitor resource loading and capacity

### 5. Advanced Configuration Management
- **Categories Tab**: Manage opportunity categories with TCV ranges and automatic categorization
- **Stage Efforts Tab**: Configure stage-based effort estimates for different opportunity categories
- **SME Rules Tab**: Set SME allocation rules by service line with detailed configuration options
- **Service Line Allocation Tab**: Advanced resource allocation interface with integrated charts and visual feedback

## Data Models

### Core Entities

**Opportunity**: Main opportunity record with stage, amount, dates
**OpportunityLineItem**: Service line revenue breakdown per opportunity
**OpportunityCategory**: TCV-based categorization rules
**StageEffortEstimate**: Default effort estimates per stage/category
**SMEAllocationRule**: SME effort calculations by service line

### Service Lines

The application tracks six service lines:
- **CES**: Consulting & Engineering Services
- **INS**: Infrastructure Services  
- **BPS**: Business Process Services
- **SEC**: Security Services
- **ITOC**: IT Operations & Cloud
- **MW**: Modern Workplace

## API Documentation

### Key Endpoints

**Opportunities:**
- `GET /api/opportunities/` - List opportunities with filtering
- `GET /api/opportunities/{id}` - Get opportunity details
- `PUT /api/opportunities/{id}` - Update opportunity
- `GET /api/opportunities/{id}/line-items` - Get service line breakdown

**Forecasting:**
- `GET /api/forecast/summary` - Get forecast summary metrics
- `GET /api/forecast/service-lines` - Get service line analysis

**Import:**
- `POST /api/import/excel` - Import opportunities Excel file
- `POST /api/import/line-items` - Import line items Excel file  
- `GET /api/import/status/{task_id}` - Check import progress

**Configuration:**
- `GET/POST /api/config/categories` - Manage opportunity categories
- `GET/POST /api/config/stage-effort` - Manage effort estimates
- `GET/POST /api/config/sme-rules` - Manage SME allocation rules

## Development

### Running Tests

**Backend tests:**
```bash
cd backend
pytest
```

**Frontend tests:**
```bash
cd frontend  
npm test
# Uses React Testing Library 16.3.0 (React 19 compatible)
# Jest DOM 6.6.3 for enhanced testing capabilities
```

### Code Quality

The project includes pre-commit hooks for code formatting and linting:

```bash
cd backend
pre-commit install
```

This will run:
- Black (Python formatting)
- isort (Import sorting)
- flake8 (Python linting)

### Database Migrations

When modifying models, create new migrations:

```bash
cd backend
python3 -m alembic revision --autogenerate -m "Description of changes"
python3 -m alembic upgrade head
```

## DXC Branding

This application follows DXC Technology's official brand guidelines:

### Color Palette
- **Primary**: DXC Bright Purple (#5F249F) integrated throughout the interface
- **Accent Colors**: Teal (#14B8A6), Blue (#3B82F6), Green (#10B981), Orange (#F59E0B), Gold (#EAB308) used in priority order
- **Neutrals**: Light Gray (#F9FAFB), Medium Gray (#6B7280), Dark Gray (#374151)
- **Charts**: Custom color schemes for Recharts with DXC palette integration

### Typography
- **Font**: Arial font family with system fallback to sans-serif
- **Hierarchy**: Bold for headers, regular for body text with DXC-specific sizing
- **Custom Sizes**: `text-dxc-slide`, `text-dxc-subtitle`, `text-dxc-body` for consistent scaling
- **Responsive**: Scaling based on DXC presentation standards across all device sizes

### Design Principles  
- Clean, flat design principles without 3D effects or shadows
- Professional enterprise appearance with DXC brand consistency
- Consistent spacing using Tailwind's design system
- Purple-first color usage in primary UI elements
- Lucide React icons for visual consistency
- Custom utility classes (`.btn-primary`, `.btn-secondary`, `.card`, `.table`, `.badge`) for component standardization

## Production Deployment

### Backend Production Setup
```bash
# Install production dependencies
pip install -r requirements.txt

# Run with production ASGI server
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend Production Build
```bash
# Build for production
npm run build

# Serve static files (can be integrated with FastAPI)
npm run preview
```

### Database Considerations
- For production, consider migrating from SQLite to PostgreSQL
- Implement proper backup strategies
- Set up monitoring and logging

## Contributing

1. Follow DXC coding standards and brand guidelines
2. Write tests for new features
3. Update documentation as needed
4. Use pre-commit hooks for code quality
5. Follow semantic versioning for releases

## Support

For internal DXC Technology use only. For questions or issues:

1. Check the API documentation at `/docs` endpoint
2. Review the technical specification documents
3. Contact the development team

---

**DXC Internal** - Resource Forecasting & Opportunity Tracker v1.0.0