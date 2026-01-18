# Academy Management System (학원 통합 관리 시스템)

## Overview

This is a comprehensive academy (학원) management platform built as a responsive web application. The system integrates class scheduling, homework management, assessments, and video content delivery into a unified platform. It supports a **7-tier user role hierarchy**: Admin, Principal, Teacher, Clinic Teacher, Student, Parent, and Kiosk. Higher-level accounts inherit all permissions from lower levels. The platform features separate interfaces for students versus teachers/administrators, while both share the same underlying database for seamless data interaction. The project aims to streamline academy operations, enhance communication between stakeholders, and provide a robust learning environment.

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
- **Role-Based Access**: Seven-tier permission hierarchy:
  - Kiosk Lv-1: Attendance pad only (auto-redirects to `/attendance-pad`)
  - Parent Lv0: Read-only tuition access
  - Student Lv1: Homework, assessments, videos
  - Teacher Lv2 / Clinic Teacher Lv2: Class management, attendance
  - Principal Lv3: Center-wide management
  - Admin Lv4: Full system access
- **Kiosk Account**: Special account type for dedicated attendance pad devices. Created by Admin, automatically redirects to `/attendance-pad` on login with simplified UI and logout via settings.
- **Multi-Center Support**: Users can belong to multiple centers (N:M relationship)
- **Initial Centers**: DMC센터 and 목동센터 with sample data

### Key Features & Implementations
- **User Management**: Multi-role accounts, password reset for Admin/Principal, homeroom teacher assignment.
- **Tuition Management**: Fee calculation, tuition guidance (rich text with image upload), tuition notification SMS (with SOLAPI integration), password-protected access for parents/students.
- **Study Cafe**: Seat reservation system (2-hour student reservations, fixed staff assignments), per-center enable/disable.
- **Class Notes**: Common class notes and student-specific notes with CRUD operations and weekly organization.
- **Attendance System**: Student check-in via PIN on kiosk pad, attendance management, PIN management, message templates for notifications.
- **Teacher Work Records**: Teacher check-in/check-out tracking via attendance pad. Features include:
    - Separate check-in (출근) and check-out (퇴근) buttons in attendance pad for teachers
    - First punch of the day is always recorded as check-in, subsequent punches update check-out time
    - Work time calculation in minutes (displayed as hours and minutes)
    - Missing check-out records are automatically marked "퇴근 기록 없음" by midnight scheduler
    - 1-year data retention policy with automatic cleanup
    - Management tab in `/management` page for Admin/Principal to view teacher work records with date range filter
- **Clinic System**:
    - **New Template-based**: Weekly recurring workflow with persistent student profiles and weekly file/feedback records. Includes resource management with permanent/temporary files.
    - **Legacy**: Original remedial instruction tracking (retained for backward compatibility).
- **Dashboard Analytics**: Monthly student count charts with year-over-year comparison for Admin/Principal.
- **Marketing Calendar**: Marketing campaign tracking system in Management tab (Admin/Principal only). Features include:
    - Campaign CRUD with name, channel, start/end dates, budget, and notes
    - Supported channels: 네이버 블로그, 네이버 검색광고, 구글 광고, 인스타그램, 페이스북, 유튜브, 카카오톡, 전단지/현수막, 지인소개 프로모션, 지역 행사, 기타
    - Year-over-year comparison bar chart showing monthly marketing spend
    - Summary cards for current year total, last year total, and YoY change percentage
    - Campaign list with edit/delete functionality
    - Validation: budget > 0, endDate >= startDate
- **Cache Invalidation**: Helper function `invalidateQueriesStartingWith(pathPrefix)` for predicate-based cache invalidation.

### Route Structure
- `/` - Dashboard
- `/timetable` - Class schedule
- `/homework` - Homework
- `/class-notes` - Class notes
- `/assessments` - Assessments
- `/clinic` - Clinic management
- `/videos` - Video content
- `/textbooks` - Textbook resources
- `/users` - User management
- `/centers` - Center management
- `/settings` - User preferences
- `/attendance-pad` - Student attendance kiosk
- `/tuition` - Tuition management
- `/student-reports` - Monthly AI-generated student reports
- `/study-cafe` - Study cafe seat reservations
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
- **SMS/Messaging**: SOLAPI (for tuition notifications, per-center credentials encrypted with AES-256-GCM)
- **Future Integrations (Recommended)**: Toss Payments (토스페이먼츠) for online payment gateway.