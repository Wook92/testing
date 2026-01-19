# Academy Management System (학원 통합 관리 시스템)

## Overview

This is a comprehensive academy (학원) management platform built as a responsive web application. The system integrates class scheduling, homework management, assessments, and video content delivery into a unified platform. It supports a **5-tier user role hierarchy**: Principal, Teacher, Student, Parent, and Kiosk. Higher-level accounts inherit all permissions from lower levels. The platform features separate interfaces for students versus teachers/administrators, while both share the same underlying database for seamless data interaction. The project aims to streamline academy operations, enhance communication between stakeholders, and provide a robust learning environment.

**Branding**: 로고 (Logo)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state, React Context for auth/theme
- **UI Components**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with CSS variables (light/dark mode)
- **Design System**: Material Design 3 principles
- **Typography**: Noto Sans KR + Inter

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful JSON API (`/api` prefix)
- **Build System**: Vite for frontend, esbuild for server bundling
- **Development**: Hot module replacement via Vite middleware

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Drizzle Kit

### Authentication & Authorization
- **Session Management**: Local storage-based auth context
- **Role-Based Access**: Five-tier permission hierarchy:
  - 출결 계정 Lv-1: Attendance pad only (auto-redirects to `/attendance-pad`)
  - Parent Lv0: Read-only access
  - Student Lv1: Homework, assessments, points
  - Teacher Lv2: Class management, attendance, class notes, homework
  - Principal Lv3: Full system access (all teacher features + user management, points management)
- **출결 계정 (Check-in Account)**: Special account type for dedicated attendance pad devices. Created by Principal in user management, automatically redirects to `/attendance-pad` on login with simplified UI and logout button.
- **Single Academy Mode**: System operates as a single academy without center/branch filtering

### Key Features & Implementations
- **User Management**: Multi-role accounts, password reset for Principal, homeroom teacher assignment.
- **Class Notes**: Common class notes and student-specific notes with CRUD operations and weekly organization.
- **Attendance System**: Student check-in via PIN on kiosk pad, attendance management, PIN management, message templates for notifications.
- **Teacher Work Records**: Teacher check-in/check-out tracking via attendance pad. Features include:
    - Separate check-in (출근) and check-out (퇴근) buttons in attendance pad for teachers
    - First punch of the day is always recorded as check-in, subsequent punches update check-out time
    - Work time calculation in minutes (displayed as hours and minutes)
    - Missing check-out records are automatically marked "퇴근 기록 없음" by midnight scheduler
    - 1-year data retention policy with automatic cleanup
    - Management tab in `/management` page for Principal to view teacher work records with date range filter
- **Dashboard Analytics**: Monthly student count charts with year-over-year comparison for Principal.
- **Marketing Calendar**: Marketing campaign tracking system in Management tab (Principal only). Features include:
    - Campaign CRUD with name, channel, start/end dates, budget, and notes
    - Supported channels: 네이버 블로그, 네이버 검색광고, 구글 광고, 인스타그램, 페이스북, 유튜브, 카카오톡, 전단지/현수막, 지인소개 프로모션, 지역 행사, 기타
    - Year-over-year comparison bar chart showing monthly marketing spend
    - Summary cards for current year total, last year total, and YoY change percentage
    - Campaign list with edit/delete functionality
    - Validation: budget > 0, endDate >= startDate
- **Cache Invalidation**: Helper function `invalidateQueriesStartingWith(pathPrefix)` for predicate-based cache invalidation.
- **Calendar System (학원 캘린더)**: Academy event management. Features include:
    - Monthly calendar view with event display
    - 12 pastel color options for event customization
    - Single-day and date-range event support
    - Multi-day events displayed as connected lines across calendar dates
    - CRUD operations for teachers and above
    - Event list view with filtering by current month

### Route Structure
- `/` - Dashboard
- `/timetable` - Class schedule and class planning (integrated tabs for teachers/principals)
- `/homework` - Homework
- `/class-notes` - Class notes
- `/assessments` - Assessments
- `/users` - User management
- `/settings` - User preferences
- `/attendance-pad` - Student attendance kiosk
- `/student-reports` - Monthly student reports (manual creation with SMS to parents)
- `/announcements` - Parent announcements with SMS notification
- `/points` - Student points view
- `/points-management` - Points management (teacher/principal)
- `/management` - System management (Principal only)
- `/calendar` - School and academy event calendar
- `/manual` - User manual and documentation

### Manual Documentation
- **Location**: `client/src/pages/manual.tsx`
- **Purpose**: In-app user manual with feature descriptions, usage steps, and tips
- **Structure**: Each feature/tab has its own section with:
  - Title and description
  - Role-based access information
  - Step-by-step usage instructions
  - Tips and notes
  - Last updated date
- **IMPORTANT**: When adding or modifying features, update the corresponding section in `manual.tsx`:
  1. Add new sections to `manualSections` array for new features
  2. Update `features`, `steps`, or `tips` for modified features
  3. Update `lastUpdated` field to current year-month (e.g., "2025-01")
  4. Ensure `roles` array reflects which user roles can access the feature

### Automatic Grade Promotion
- **Trigger**: Server startup and daily check (24-hour interval)
- **Logic**: On January 1st, all student grades are promoted one level
- **Transitions**: 초6→중1, 중3→고1, 고3 remains 고3
- **Tracking**: `system_settings` table stores `lastPromotionYear` to prevent double promotions

## External Dependencies

- **UI Frameworks**: Radix UI, shadcn/ui, Embla Carousel, Vaul, cmdk
- **Data & Validation**: Zod, drizzle-zod, date-fns
- **Development Tools**: Vite, Replit-specific plugins, TypeScript
- **Database**: PostgreSQL (via `DATABASE_URL`), connect-pg-simple
- **SMS/Messaging**: SOLAPI (for tuition notifications and student reports, per-center credentials encrypted with AES-256-GCM)
- **Future Integrations (Recommended)**: Toss Payments (토스페이먼츠) for online payment gateway.

## Deployment Guide (Railway + Neon DB + Cloudflare R2)

### Prerequisites
- Railway account (https://railway.app)
- Neon DB account (https://neon.tech)
- Cloudflare R2 account (https://dash.cloudflare.com)

### 1. Neon DB Setup
1. Create a new project in Neon console
2. Copy the connection string (DATABASE_URL)
3. Format: `postgresql://user:password@host/database?sslmode=require`

### 2. Cloudflare R2 Setup
1. Go to Cloudflare Dashboard > R2
2. Create a new bucket
3. Create API tokens with read/write permissions
4. Note down:
   - R2_ACCOUNT_ID: Your Cloudflare account ID
   - R2_ACCESS_KEY_ID: API token access key
   - R2_SECRET_ACCESS_KEY: API token secret
   - R2_BUCKET_NAME: Your bucket name
   - R2_PUBLIC_URL: Public URL for the bucket (if using custom domain)

### 3. Railway Deployment
1. Create new project in Railway
2. Connect your GitHub repository
3. Add environment variables:
   ```
   DATABASE_URL=<neon-connection-string>
   SESSION_SECRET=<random-secure-string>
   NODE_ENV=production
   R2_ACCOUNT_ID=<cloudflare-account-id>
   R2_ACCESS_KEY_ID=<r2-access-key>
   R2_SECRET_ACCESS_KEY=<r2-secret>
   R2_BUCKET_NAME=<bucket-name>
   R2_PUBLIC_URL=<public-url>
   ```
4. Set build command: `npm run build`
5. Set start command: `npm start`
6. Deploy

### 4. Database Migration
After deployment, the server will automatically create required tables on first startup.

### Environment Variables Reference
| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| SESSION_SECRET | Yes | Session encryption key |
| R2_ACCOUNT_ID | Yes | Cloudflare account ID |
| R2_ACCESS_KEY_ID | Yes | R2 API access key |
| R2_SECRET_ACCESS_KEY | Yes | R2 API secret |
| R2_BUCKET_NAME | Yes | R2 bucket name |
| R2_PUBLIC_URL | No | Public URL for R2 bucket |
| SOLAPI_API_KEY | No | SOLAPI key for SMS |
| SOLAPI_API_SECRET | No | SOLAPI secret |
| SOLAPI_SENDER_NUMBER | No | SMS sender number |

## Recent Changes (January 2026)

### Center Functionality Removal
- Removed all center/branch filtering system-wide
- System now operates as a single academy mode
- All API routes updated to work without centerId parameters
- UI removed center selector from all pages

### Role System Simplification
- Removed ADMIN and CLINIC_TEACHER roles
- PRINCIPAL now has all administrative permissions (previously ADMIN)
- Simplified 5-tier hierarchy: PRINCIPAL > TEACHER > STUDENT > PARENT > KIOSK

### Features Added
- **Points System**: Student reward points with manual add/use by teachers and view by students
- **Class Planning**: Weekly and monthly class planning per class
- **Student Reports**: Monthly reports with SMS sending (AI generation removed, now manual)
- **Announcements (공지사항)**: Parent management system with:
  - Create/edit/delete announcements for parents
  - Target by class, grade, or specific students
  - SMS notification to parents via SOLAPI
  - Collapsible "학부모 관리" menu in sidebar with sub-items

### Features Removed
- Photo upload in homework management (simplified)
- AI generation in monthly reports (replaced with manual writing)
- Tabs removed from sidebar: 경영, 센터관리, 스터디카페, 교재영상, 교육비, 클리닉, 수업영상
- Center selector and center filtering across all pages