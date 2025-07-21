# Product Requirements Document (PRD): Resource Forecasting & Opportunity Tracker

## 1. Overview
This application is a local-only internal tool designed to support resource forecasting and tracking of Salesforce opportunities. The system will import opportunity data via Excel, display editable opportunity lists, dashboards, and provide calculated forecasts based on effort rules. It uses a local SQLite database and a React frontend with a FastAPI backend.

## 2. Goals
- Track opportunity and resource allocation using Salesforce export data
- Provide forecast dashboards with configurable parameters
- Enable editing of opportunity status, resource assignments, and notes
- Automatically categorize opportunities based on TCV
- Forecast effort and SME needs using stage/category rules
- Track and forecast resources by service line (CES, INS, BPS, SEC, ITOC, MW)
- Enable service line-specific resource planning and allocation
- Maintain all configuration data via a simple admin UI

## 3. Users
| Role        | Description                                              |
|-------------|----------------------------------------------------------|
| Planner     | Views forecasts, edits allocations and statuses         |
| Admin       | Manages configuration and imports data                 |

## 4. Assumptions
- Salesforce data will be imported manually via Excel
- SQLite database is stored locally (no cloud deployment or Docker initially)
- No user authentication is required for the MVP
- App is not mobile-friendly
- Database migrations will be managed via Alembic
- Excel processing will run as background tasks to avoid blocking UI
- TypeScript will be used for frontend type safety

## 5. Success Criteria
- Accurate parsing of Excel and normalized storage in SQLite
- Responsive dashboard with filters and charts
- Editable opportunity details
- Forecasting based on configurable effort rules
- Config page enables real-time updates to categorization and calculation logic
- Type-safe frontend with TypeScript
- Robust error handling and logging
- Background processing for Excel imports
- Database schema versioning with migrations

## 6. Features Summary
- Excel-based import (including opportunity line items for service line breakdown)
- Opportunity list with search/filter/edit
- Forecast dashboard with visualizations
- Opportunity detail views
- Resource load tracking
- Service line allocation tracking and forecasting
- Opportunity categorization (Sub $5M, Cat C, Cat B, Cat A)
- Configurable default effort/duration per category + Salesforce stage
- SME allocation logic based on revenue and SME team rules
- Service line-specific resource planning
- Config admin page
