# Technical Specification: Resource Forecasting & Opportunity Tracker

## 1. Stack Overview
| Layer            | Technology                                  |
|------------------|----------------------------------------------|
| Frontend         | React (Vite), TypeScript, Tailwind CSS      |
| State Management | React Query (TanStack Query)                |
| Backend          | FastAPI, SQLModel, Pydantic, Uvicorn        |
| Database         | SQLite, Alembic (migrations)                |
| Excel Import     | pandas, openpyxl, Background Tasks          |
| Testing          | pytest, React Testing Library               |
| Code Quality     | black, isort, flake8, pre-commit hooks      |
| Logging          | structlog                                    |

---

## 2. Backend Architecture

### 2.1 Key Models (SQLModel)
```python
class Opportunity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    opportunity_id: str
    name: str
    stage: str
    amount: float
    close_date: date
    assigned_resource: Optional[str]
    status: Optional[str]
    notes: Optional[str]
    category: Optional[str]
```

```python
class OpportunityCategory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    min_tcv: float
    max_tcv: Optional[float]
```

```python
class StageEffortEstimate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = ForeignKey("opportunitycategory.id")
    stage_name: str
    default_effort_weeks: float
    default_duration_weeks: int
```

```python
class SMEAllocationRule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_name: str
    effort_per_million: float
```

```python
class OpportunityLineItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    opportunity_id: str = Field(foreign_key="opportunity.opportunity_id")
    ces_revenue: Optional[float] = Field(default=0)  # CES (M)
    ins_revenue: Optional[float] = Field(default=0)  # INS (M) 
    bps_revenue: Optional[float] = Field(default=0)  # BPS (M)
    sec_revenue: Optional[float] = Field(default=0)  # SEC (M)
    itoc_revenue: Optional[float] = Field(default=0) # ITOC (M)
    mw_revenue: Optional[float] = Field(default=0)   # MW (M)
    tcv: float
    contract_length: Optional[float]
    in_forecast: Optional[str]
```

### 2.2 Endpoints
```
GET    /api/opportunities/
GET    /api/opportunities/{id}
PUT    /api/opportunities/{id}
GET    /api/opportunities/{id}/line-items
POST   /api/import/excel           # Returns task_id for background processing
POST   /api/import/line-items      # Returns task_id for background processing
GET    /api/import/status/{task_id} # Check import progress
GET    /api/forecast/summary
GET    /api/forecast/service-lines
GET    /api/resources/

GET/POST /api/config/categories
GET/POST /api/config/stage-effort
GET/POST /api/config/sme-rules
```

---

## 3. Excel Import Logic
```python
import pandas as pd
from sqlmodel import Session
from fastapi import BackgroundTasks
from pydantic import BaseModel, validator
from models import Opportunity, OpportunityLineItem
import structlog
import uuid

logger = structlog.get_logger()

class ImportTask(BaseModel):
    task_id: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: int
    message: str

# In-memory task store (use Redis/DB for production)
import_tasks = {}

def validate_excel_data(df: pd.DataFrame, required_columns: list) -> None:
    """Validate Excel data structure and content"""
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")
    
    # Additional validation logic here
    
async def import_excel_background(file_path: str, task_id: str):
    """Background task for Excel import with progress tracking"""
    try:
        import_tasks[task_id] = ImportTask(
            task_id=task_id, status="processing", progress=0, message="Reading Excel file"
        )
        
        df = pd.read_excel(file_path)
        validate_excel_data(df, ["Opportunity ID", "Name", "Stage", "Amount", "Close Date"])
        
        total_rows = len(df)
        with Session(engine) as session:
            for idx, (_, row) in enumerate(df.iterrows()):
                try:
                    opp = Opportunity(
                        opportunity_id=row["Opportunity ID"],
                        name=row["Name"],
                        stage=row["Stage"],
                        amount=row["Amount"],
                        close_date=row["Close Date"]
                    )
                    session.add(opp)
                    
                    # Update progress
                    progress = int((idx + 1) / total_rows * 100)
                    import_tasks[task_id].progress = progress
                    import_tasks[task_id].message = f"Processing row {idx + 1} of {total_rows}"
                    
                except Exception as e:
                    logger.error("Row processing error", row_idx=idx, error=str(e))
                    continue
                    
            session.commit()
            import_tasks[task_id].status = "completed"
            import_tasks[task_id].message = f"Successfully imported {total_rows} opportunities"
            logger.info("Excel import completed", task_id=task_id, rows=total_rows)
            
    except Exception as e:
        import_tasks[task_id].status = "failed"
        import_tasks[task_id].message = f"Import failed: {str(e)}"
        logger.error("Excel import failed", task_id=task_id, error=str(e))

def start_excel_import(file_path: str, background_tasks: BackgroundTasks) -> str:
    """Start Excel import as background task"""
    task_id = str(uuid.uuid4())
    background_tasks.add_task(import_excel_background, file_path, task_id)
    return task_id

def get_import_status(task_id: str) -> ImportTask:
    """Get import task status"""
    return import_tasks.get(task_id, ImportTask(
        task_id=task_id, status="not_found", progress=0, message="Task not found"
    ))
```

---

## 4. Frontend Structure (TypeScript + React Query)

### Pages
- `/dashboard` – Forecast overview
- `/opportunities` – Opportunity list + filters
- `/opportunity/:id` – Detail + edit view
- `/resources` – Resource load view
- `/config` – Admin config interface

### Components
- `OpportunityTable` – with React Query data fetching
- `OpportunityDetailForm` – with optimistic updates
- `ServiceLineBreakdown` – TypeScript interface for service line data
- `ServiceLineChart` – with proper type definitions
- `ForecastChart` – typed chart data props
- `ExcelUploader` – with progress tracking and error handling
- `LineItemUploader` – background import with status polling
- `ConfigForm` – with form validation
- `ImportProgressModal` – for tracking background tasks
- `ErrorBoundary` – global error handling

### State Management
```typescript
// React Query hooks for data fetching
const useOpportunities = (filters?: OpportunityFilters) => useQuery({
  queryKey: ['opportunities', filters],
  queryFn: () => api.getOpportunities(filters)
})

const useImportStatus = (taskId: string) => useQuery({
  queryKey: ['import-status', taskId],
  queryFn: () => api.getImportStatus(taskId),
  refetchInterval: 1000, // Poll every second while processing
  enabled: !!taskId
})
```

### Type Definitions
```typescript
interface Opportunity {
  id?: number;
  opportunity_id: string;
  name: string;
  stage: string;
  amount: number;
  close_date: Date;
  assigned_resource?: string;
  status?: string;
  notes?: string;
  category?: string;
}

interface ImportTask {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
}
```

---

## 5. Deployment Notes
- Backend runs locally via `uvicorn main:app --reload`
- Frontend served via `vite dev` (development) or static build mounted in FastAPI
- SQLite file stored locally (e.g., `./database.db`)
- Database migrations managed via Alembic: `alembic upgrade head`
- Pre-commit hooks ensure code quality before commits
- Testing via `pytest` (backend) and `npm test` (frontend)

## 6. Development Setup
```bash
# Backend setup
pip install fastapi sqlmodel alembic pandas openpyxl structlog pytest black isort flake8
alembic init alembic
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head

# Frontend setup  
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @tanstack/react-query tailwindcss @testing-library/react @testing-library/jest-dom

# Pre-commit hooks
pip install pre-commit
pre-commit install
```

## 7. Testing Strategy
- **Backend**: pytest with test database, API endpoint testing
- **Frontend**: React Testing Library for component testing
- **Integration**: End-to-end testing of Excel import flow
- **Error Handling**: Test error boundaries and API error responses
