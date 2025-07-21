# Functional Specification: Resource Forecasting & Opportunity Tracker

## 1. Key Functional Areas

### 1.1 Excel Import
- Upload `.xlsx` file for opportunities
- Upload `.xlsx` file for opportunity line items (service line breakdown)
- Parse with pandas
- Deduplicate by `opportunity_id`
- Populate SQLite with normalized structure including service line allocation

### 1.2 Opportunity List View
- Display all opportunities with pagination
- Filters: Stage, Status, Category, Close Date Range, Service Line
- Search by name or Opportunity ID
- Sort by TCV, Date, Status
- Show service line revenue breakdown in table columns

### 1.3 Opportunity Detail Page
- Editable: Resource Assigned, Status, Notes
- Read-only: Name, Stage, Amount, Close Date
- Service line revenue breakdown chart (CES, INS, BPS, SEC, ITOC, MW)
- Service line-specific resource assignments
- Save back to database

### 1.4 Forecast Dashboard
- Timeline chart showing effort by week (with month/quarter views available)
- Filter by Stage, Team, Date Range, Category, Service Line
- Service line allocation dashboard showing revenue distribution
- Charts: Recharts (line/bar/pie for service line breakdown)
- Summary metrics: total FTE, overbooked roles, service line capacity

### 1.5 Resource View
- List of resources + current allocation load
- Heatmap of workload by week (with month/quarter views available)
- Filter by team or availability status

### 1.6 Opportunity Categorization
- Based on TCV:
  - Sub $5M (<5M)
  - Cat C (5M–25M)
  - Cat B (25M–50M)
  - Cat A (50M+)
- Category assigned automatically during import or update

### 1.7 Stage-Based Effort/Duration
- Default values stored per stage/category in FTE-weeks
- Used to calculate expected effort with conversion to months/quarters as needed
- Configurable via admin UI with week-based parameters

### 1.8 SME Allocation Forecasting
- SME effort = TCV × rule for team
- Service line-specific SME rules (different effort rates per service line)
- Rules defined in config (e.g., 4 FTE days per $1M for CES, 6 FTE days per $1M for SEC)
- Used in dashboard and detail view

### 1.9 Configuration Page (`/config`)
- Manage:
  - Opportunity Categories
  - Stage effort/duration (FTE-weeks with conversion utilities)
  - SME allocation rules
  - Service line-specific SME rules and rates
- Forms for CRUD operations
- React UI with tabs or accordion layout

### 1.10 Service Line Management
- Track revenue allocation across 6 service lines: CES, INS, BPS, SEC, ITOC, MW
- Service line filtering and reporting
- Service line-specific resource forecasting
- Visual breakdown of service line distribution per opportunity
