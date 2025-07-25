# RFOT Frontend

React 19 + TypeScript + Vite frontend for the Resource Forecasting & Opportunity Tracker.

## Features

- **V2 Enhanced UI** - Modern, condensed interface as default experience
- **React 19.1.0** - Latest React with concurrent features  
- **TypeScript 5.8.3** - Full type safety throughout
- **TanStack Query 5.83.0** - Powerful server state management
- **TailwindCSS 3.4.17** - Custom DXC theming and utilities
- **Recharts 3.1.0** - Data visualization with DXC color schemes

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build
```

## Architecture

- **Pages**: V2 Enhanced UI components serve main routes by default
- **Components**: Reusable UI components with DXC branding
- **Hooks**: Custom React hooks for API integration
- **Services**: Centralized API client with error handling
- **Types**: Comprehensive TypeScript definitions

## Development

```bash
npm run dev              # Development server (http://localhost:5173)
npm run build           # Production build
npm run preview         # Preview production build
npm run lint            # ESLint code checking
```

## Configuration

Set API endpoint via environment variable:
```bash
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
```

For more details, see the main [README.md](../README.md) and [CLAUDE.md](../CLAUDE.md).