# TeamPad — Product Design Document

> **Version:** 1.0.0  
> **Status:** Active (mobile-first build)  
> **Last Updated:** 2026-01-23  
> **Owner:** Product Team

> **Current build note:** Mobile app ships core auth/workspaces/notes/chat/invites.
> AI, voice notes, focus mode, and team pulse are **planned** and remain in this doc as roadmap items.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Principles](#2-product-vision--principles)
3. [Target Users & Personas](#3-target-users--personas)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [Information Architecture](#5-information-architecture)
6. [Core User Flows](#6-core-user-flows)
7. [Feature Specification](#7-feature-specification)
8. [Data Model](#8-data-model)
9. [Roles & Permissions](#9-roles--permissions)
10. [Authentication & Security](#10-authentication--security)
11. [Realtime Collaboration](#11-realtime-collaboration)
12. [AI Features](#12-ai-features)
13. [Design System](#13-design-system)
14. [Screen Inventory](#14-screen-inventory)
15. [API Contracts](#15-api-contracts)
16. [Technical Decisions](#16-technical-decisions)
17. [Roadmap & Phases](#17-roadmap--phases)
18. [Risks & Mitigations](#18-risks--mitigations)
19. [Open Questions](#19-open-questions)
20. [Changelog](#20-changelog)

---

## 1. Executive Summary

### What is TeamPad?

TeamPad is a **team notes application** designed for internal teams, freelancers, and agencies. It prioritizes:

- **Speed of capture** — First note in under 60 seconds
- **Clear organization** — Workspace → Group → Note hierarchy
- **Lightweight collaboration** — Refresh-on-save updates without complex CRDT

### Why TeamPad?

| Problem | TeamPad Solution |
|---------|------------------|
| Note-taking apps are bloated | Minimal, focused feature set |
| Collaboration is complex | Simple refresh-on-save model |
| Organization becomes messy | Enforced workspace/group structure |
| AI is bolted on | AI assistance planned (server-ready, UI not shipped in mobile) |

### MVP Scope

| In Scope | Out of Scope (Post-MVP) |
|----------|-------------------------|
| Email/password auth + email verification code | 2FA (post-MVP) |
| Workspace/Group/Note CRUD | Nested folder hierarchies |
| Refresh-on-save realtime | Live collaborative editing (CRDT/OT) |
| Basic rich text editing | Advanced formatting (tables, embeds) |
| Role-based access (Owner/Admin/Member) | Custom permission granularity |
|  | AI summaries, action items, and AI chat interface |

---

## 2. Product Vision & Principles

### Vision Statement

> *"The fastest path from thought to shared team knowledge."*

### Product Principles

| Principle | Implementation |
|-----------|----------------|
| **Clarity over complexity** | Simple structures win. Workspace → Group → Note. No nested folders. |
| **Fast to value** | First note in under 60 seconds after sign-in. Minimal onboarding. |
| **Visible collaboration** | Show when updates happen. Clear "last edited by" attribution. |
| **Trustworthy UX** | Clear save states. Zero ambiguity on latest version. No data loss. |
| **AI as assistant** | AI suggests, user decides. Never auto-apply AI changes. |

### Design Philosophy

```
Calm > Clever
Predictable > Surprising  
Fast > Feature-rich
Clear > Compact
```

---

## 3. Target Users & Personas

### Primary Personas

#### 🏢 Internal Teams
- **Use case:** Shared docs, meeting notes, handoffs
- **Team size:** 5-50 people
- **Pain point:** Information scattered across Slack, Notion, Google Docs
- **Need:** Single source of truth for team knowledge

#### 💼 Freelancers
- **Use case:** Personal notes + client workspaces
- **Team size:** 1 (solo) + clients
- **Pain point:** Mixing personal and client notes
- **Need:** Clear workspace separation

#### 🏛️ Agencies
- **Use case:** Multi-client workspaces with team collaboration
- **Team size:** 10-100 people, multiple clients
- **Pain point:** Access control across client projects
- **Need:** Role-based permissions per workspace

### User Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                              │
├─────────────────────────────────────────────────────────────────┤
│ DISCOVER → SIGNUP → FIRST NOTE → INVITE TEAM → DAILY USE       │
│    ↓         ↓          ↓            ↓            ↓             │
│  Landing   Auth     Onboarding   Share modal   Dashboard        │
│   page    flows      wizard       + roles      workflow         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Goals & Success Metrics

### North Star Metric

**Weekly Active Notes Created per User**

### Key Performance Indicators (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first note | < 60 seconds | Analytics event: `note_created` after `signup_complete` |
| Notes created/user/week | ≥ 5 | Weekly cohort analysis |
| Save errors/session | < 0.1% | Error tracking |
| AI feature adoption | ≥ 30% | Usage of summary/action items |
| User retention (D7) | ≥ 40% | Cohort retention curves |
| User retention (D30) | ≥ 25% | Cohort retention curves |

### Success Criteria by Phase

| Phase | Success Looks Like |
|-------|-------------------|
| Alpha | 100 users, < 5 critical bugs |
| Beta | 1,000 users, NPS ≥ 30 |
| Launch | 10,000 users, revenue positive |

---

## 5. Information Architecture

### Hierarchy

```
User
 └── Workspace (top-level organization)
      ├── Members[] (users with roles)
      └── Groups (note collections)
           └── Notes (content units)
```

### Navigation Model

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│ [Workspace Switcher] [Search] [AI] [Notifications] [Profile]│
├──────────────┬──────────────────────────────────────────────┤
│   SIDEBAR    │              MAIN CONTENT                     │
│              │                                               │
│ ┌──────────┐ │  ┌─────────────────┬─────────────────────┐   │
│ │ Groups   │ │  │   Notes List    │    Note Editor      │   │
│ │          │ │  │                 │                     │   │
│ │ - Group1 │ │  │ • Note 1        │  [Title]            │   │
│ │ - Group2 │ │  │ • Note 2        │  [Body]             │   │
│ │ - Group3 │ │  │ • Note 3        │  [AI Panel]         │   │
│ └──────────┘ │  └─────────────────┴─────────────────────┘   │
│              │                                               │
│ [+ New Group]│                                               │
└──────────────┴──────────────────────────────────────────────┘
```

### URL Structure

| Route | Description |
|-------|-------------|
| `/` | Redirect to last workspace or onboarding |
| `/auth` | Authentication flows |
| `/auth/reset-password` | Password reset |
| `/w/:workspaceId` | Workspace dashboard |
| `/w/:workspaceId/g/:groupId` | Group view with notes |
| `/w/:workspaceId/g/:groupId/n/:noteId` | Note editor |
| `/w/:workspaceId/settings` | Workspace settings |
| `/w/:workspaceId/members` | Member management |
| `/settings` | User settings |

---

## 6. Core User Flows

### Flow 1: First-Time User Signup

```
1. Land on /auth (signup tab)
2. Enter name, email, password
3. Send email verification code
4. Verify code
5. Create account
6. Auto-create personal workspace
7. Show "Create your first note" prompt
8. Track: time_to_first_note
```

### Flow 2: Daily Note Taking

```
1. Open app → auto-load last workspace/group
2. Click "+ New Note" or ⌘N
3. Start typing (auto-focus on title)
4. Tab to body, write content
5. See "Saving..." → "Saved" indicator
6. Close or switch notes seamlessly
```

### Flow 3: Team Collaboration

```
1. Create workspace for team/project
2. Invite members via email
3. Assign roles (Admin/Member)
4. Create groups for organization
5. Team members create/edit notes
6. Others see "New version available" on refresh
```

### Flow 4: AI-Assisted Note Taking

```
1. Write or paste long note content
2. Open AI panel (sidebar or ⌘K)
3. Click "Summarize" → see summary
4. Click "Extract Actions" → see task list
5. Copy or dismiss suggestions
6. Optionally apply title suggestion
```

---

## 7. Feature Specification

### 7.1 Notes

#### Create Note

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| title | string | Yes | Max 200 chars |
| body | string | No | Max 100,000 chars |
| groupId | uuid | Yes | Must exist |
| isPinned | boolean | No | Default: false |

#### Note States

| State | Visual | Trigger |
|-------|--------|---------|
| Draft | Gray dot | Unsaved changes |
| Saving | Pulsing indicator | Save in progress |
| Saved | Green checkmark | Save complete |
| Error | Red indicator | Save failed |
| Stale | Yellow banner | Remote update detected |

#### Note Actions

| Action | Shortcut | Description |
|--------|----------|-------------|
| Create | ⌘N | New note in current group |
| Save | ⌘S | Manual save (auto-save exists) |
| Delete | ⌘⌫ | Move to trash (soft delete) |
| Pin | ⌘P | Pin to top of list |
| Duplicate | ⌘D | Clone note |
| Move | ⌘M | Move to different group |

### 7.2 Groups

#### Group Model

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | Yes | Max 100 chars |
| workspaceId | uuid | Yes | Must exist |
| color | string | No | Hex color code |
| icon | string | No | Emoji or icon name |

#### Group Actions

| Action | Permission | Description |
|--------|------------|-------------|
| Create | Admin+ | Add new group |
| Rename | Admin+ | Change group name |
| Delete | Admin+ | Remove group (confirm if notes exist) |
| Reorder | Admin+ | Drag to reorder in sidebar |

### 7.3 Workspaces

#### Workspace Limits

| Plan | Personal Workspaces | Team Workspaces | Members/Workspace |
|------|--------------------|-----------------|--------------------|
| Free | 1 | 0 | 1 |
| Pro | 3 | 3 | 10 |
| Team | 5 | Unlimited | 50 |
| Enterprise | Unlimited | Unlimited | Unlimited |

#### Workspace Actions

| Action | Permission | Description |
|--------|------------|-------------|
| Create | Any user | New workspace (within limits) |
| Rename | Owner | Change workspace name |
| Delete | Owner | Remove workspace (confirm) |
| Transfer | Owner | Change ownership |
| Leave | Any member | Remove self from workspace |

---

## 8. Data Model

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    User     │       │ WorkspaceMember │       │  Workspace  │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │──────<│ user_id (FK)    │>──────│ id (PK)     │
│ email       │       │ workspace_id(FK)│       │ name        │
│ name        │       │ role            │       │ created_at  │
│ avatar_url  │       │ joined_at       │       │ owner_id    │
│ created_at  │       └─────────────────┘       └──────┬──────┘
│ 2fa_enabled │                                        │
└─────────────┘                                        │
                                                       │
                              ┌─────────────┐          │
                              │    Group    │<─────────┘
                              ├─────────────┤
                              │ id (PK)     │
                              │ name        │
                              │ workspace_id│
                              │ color       │
                              │ position    │
                              └──────┬──────┘
                                     │
                              ┌──────┴──────┐
                              │    Note     │
                              ├─────────────┤
                              │ id (PK)     │
                              │ title       │
                              │ body        │
                              │ group_id    │
                              │ created_by  │
                              │ updated_by  │
                              │ created_at  │
                              │ updated_at  │
                              │ is_pinned   │
                              │ is_deleted  │
                              └─────────────┘
```

### Database Schema

```sql
-- Users (managed by auth provider)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace Members (junction table)
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  color TEXT,
  icon TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled',
  body TEXT DEFAULT '',
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notes_group_id ON notes(group_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX idx_groups_workspace_id ON groups(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
```

### TypeScript Interfaces

```typescript
// Core types for client-side usage

type UserRole = 'owner' | 'admin' | 'member';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  memberCount?: number;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: UserRole;
  joinedAt: Date;
  user?: User; // Joined data
}

interface Group {
  id: string;
  name: string;
  workspaceId: string;
  color?: string;
  icon?: string;
  position: number;
  noteCount?: number;
}

interface Note {
  id: string;
  title: string;
  body: string;
  groupId: string;
  createdBy: string;
  updatedBy: string;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByUser?: User; // Joined data
  updatedByUser?: User; // Joined data
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
```

---

## 9. Roles & Permissions

### Role Definitions

| Role | Description |
|------|-------------|
| **Owner** | Created the workspace. Full control. Can delete workspace. |
| **Admin** | Trusted team member. Manage members and groups. |
| **Member** | Standard user. Create/edit notes in accessible groups. |

### Permission Matrix

| Action | Owner | Admin | Member |
|--------|:-----:|:-----:|:------:|
| **Workspace** |
| View workspace | ✅ | ✅ | ✅ |
| Edit workspace settings | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |
| **Members** |
| View members | ✅ | ✅ | ✅ |
| Invite members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅* | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| **Groups** |
| View groups | ✅ | ✅ | ✅ |
| Create groups | ✅ | ✅ | ❌ |
| Edit groups | ✅ | ✅ | ❌ |
| Delete groups | ✅ | ✅ | ❌ |
| **Notes** |
| View notes | ✅ | ✅ | ✅ |
| Create notes | ✅ | ✅ | ✅ |
| Edit own notes | ✅ | ✅ | ✅ |
| Edit others' notes | ✅ | ✅ | ✅** |
| Delete notes | ✅ | ✅ | Own only |
| Pin notes | ✅ | ✅ | ✅ |

*Admins cannot remove other Admins or the Owner  
**Members can edit shared notes (collaborative by default)

---

## 10. Authentication & Security

### Auth Methods

| Method | MVP | Post-MVP |
|--------|:---:|:--------:|
| Email/Password | ✅ | ✅ |
| Email verification code (signup) | ✅ | ✅ |
| Email OTP 2FA | ❌ | ✅ |
| Magic Link | ❌ | ✅ |
| Google OAuth | ❌ | ✅ |
| GitHub OAuth | ❌ | ❌ |
| SSO/SAML | ❌ | Enterprise |

### Auth Flows

#### Login Flow

```
1. Enter email + password
2. Validate credentials
3. Create session cookie
4. Redirect to dashboard

#### Signup Flow

```
1. Enter name, email, password
2. Send verification code
3. Enter code
4. Create session cookie
5. Redirect to dashboard
```
```

#### Password Reset Flow

```
1. Enter email
2. Send reset link (1-hour expiry)
3. Click link → reset password page
4. Enter new password (validate strength)
5. Invalidate all existing sessions
6. Redirect to login
```

### Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| Password strength | Min 8 characters |
| Session duration | 7 days (JWT cookie) |
| Signup code expiry | 10 minutes |
| Rate limiting | 5 attempts per 15 minutes |
| HTTPS only | Enforced in production |
| XSS protection | React escaping + CSP headers |
| CSRF protection | SameSite cookies |

### Token Strategy

```
┌─────────────────────────────────────────────────────────┐
│                 SESSION COOKIE FLOW                     │
├─────────────────────────────────────────────────────────┤
│  Login → Server sets HTTP-only JWT cookie               │
│                         ↓                                │
│  API Request → Cookie sent automatically                │
│                         ↓                                │
│  Token expired? → Redirect to login                     │
└─────────────────────────────────────────────────────────┘
```

---

## 11. Realtime Collaboration

### Collaboration Model

TeamPad uses **refresh-on-save** rather than live collaborative editing:

| Aspect | Our Approach | Why |
|--------|--------------|-----|
| Model | Refresh-on-save | Simpler, more predictable |
| Conflict resolution | Last-write-wins | Avoids CRDT complexity |
| User awareness | "New version available" banner | Clear, non-disruptive |
| Implementation | Pusher/Supabase Realtime | Reliable, scalable |

### Realtime Events

| Event | Trigger | Client Action |
|-------|---------|---------------|
| `note:updated` | Note saved | Show "New version" banner |
| `note:created` | New note | Add to list |
| `note:deleted` | Note deleted | Remove from list |
| `member:joined` | New member | Update member count |
| `member:left` | Member removed | Update member count |

### Version Banner UX

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ New version available • Sarah updated 30s ago       │
│                                    [Refresh] [Dismiss]  │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Appears when remote update detected
- Shows who updated and when
- "Refresh" reloads note content
- "Dismiss" hides banner (until next update)
- Auto-refresh option (user preference)

---

## 12. AI Features

### MVP AI Features

| Feature | Input | Output | Use Case |
|---------|-------|--------|----------|
| **Summarize** | Note body | 2-3 sentence summary | Quick note overview |
| **Extract Actions** | Note body | List of action items | Meeting notes → tasks |
| **Suggest Title** | Note body | 3 title options | Untitled notes |
| **Smart Search** | Query | Relevant notes | Find by concept |

### AI Panel Design

```
┌─────────────────────────────────┐
│ 🤖 AI Assistant                 │
├─────────────────────────────────┤
│                                 │
│ [Summarize] [Actions] [Title]   │
│                                 │
├─────────────────────────────────┤
│ Summary                         │
│ ─────────────────────────────── │
│ This note covers the Q4         │
│ marketing strategy focusing     │
│ on social media expansion...    │
│                                 │
│            [Copy] [Dismiss]     │
├─────────────────────────────────┤
│ Action Items                    │
│ ─────────────────────────────── │
│ □ Review social media budget    │
│ □ Schedule team sync            │
│ □ Draft campaign brief          │
│                                 │
│       [Copy All] [Dismiss]      │
└─────────────────────────────────┘
```

### AI Implementation

| Aspect | Decision |
|--------|----------|
| Provider | OpenAI (GPT-4o-mini for speed) |
| Rate limit | 50 requests/user/day (MVP) |
| Caching | Cache summaries per note version |
| Fallback | Graceful degradation if API fails |

### AI Prompts (Reference)

```
// Summary prompt
You are a note summarization assistant. 
Summarize the following note in 2-3 concise sentences.
Focus on key points and decisions.
Note: {noteBody}

// Action items prompt
Extract actionable tasks from this note.
Return as a bullet list.
Include assignee if mentioned.
Note: {noteBody}

// Title suggestion prompt
Suggest 3 concise titles for this note.
Each title should be under 60 characters.
Note: {noteBody}
```

---

## 13. Design System

### Color Palette

#### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--background` | White | Slate 950 | Page background |
| `--foreground` | Slate 900 | Slate 50 | Primary text |
| `--primary` | Sky 500 | Sky 400 | CTAs, links |
| `--primary-foreground` | White | Slate 900 | Text on primary |
| `--secondary` | Slate 100 | Slate 800 | Secondary surfaces |
| `--muted` | Slate 100 | Slate 800 | Muted backgrounds |
| `--muted-foreground` | Slate 500 | Slate 400 | Muted text |
| `--destructive` | Red 500 | Red 400 | Errors, delete |
| `--success` | Green 500 | Green 400 | Success states |
| `--warning` | Amber 500 | Amber 400 | Warnings |
| `--border` | Slate 200 | Slate 700 | Borders |

#### Brand Colors

```
Primary:    Sky Blue  (#0ea5e9)
Secondary:  Black     (#0f172a)
Accent:     White     (#ffffff)
Status:     Red/Green (reserved for status only)
```

### Typography

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| H1 | Inter | 36px | 700 | 1.2 |
| H2 | Inter | 24px | 600 | 1.3 |
| H3 | Inter | 18px | 600 | 1.4 |
| Body | Inter | 14px | 400 | 1.6 |
| Small | Inter | 12px | 400 | 1.5 |
| Code | JetBrains Mono | 13px | 400 | 1.5 |

### Spacing Scale

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

### Component Library

| Component | Variants | States |
|-----------|----------|--------|
| Button | default, secondary, ghost, destructive, success | hover, active, disabled, loading |
| Input | default, error | focus, disabled |
| Card | default, interactive | hover |
| Badge | default, success, warning, destructive | - |
| Avatar | sizes: sm, md, lg | with fallback |
| Tooltip | - | - |
| Dialog | default, alert | - |
| Dropdown | - | - |

### Animation Tokens

```css
--transition-fast: 150ms ease
--transition-base: 200ms ease
--transition-slow: 300ms ease
--transition-spring: 300ms cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## 14. Screen Inventory

### Auth Screens

| Screen | Route | Components |
|--------|-------|------------|
| Login | `/auth?view=login` | EmailInput, PasswordInput, SubmitButton |
| Signup | `/auth?view=signup` | NameInput, EmailInput, PasswordInput |
| OTP Verification | `/auth?view=otp` | OTPInput (6 digits), ResendButton |
| Forgot Password | `/auth?view=forgot-password` | EmailInput, SubmitButton |
| Reset Password | `/auth?view=reset-password` | PasswordInput x2, SubmitButton |

### Dashboard Screens

| Screen | Route | Components |
|--------|-------|------------|
| Dashboard | `/w/:id` | Sidebar, Header, NotesList, NoteEditor |
| Empty State | `/w/:id` (no notes) | EmptyState, CreateNoteButton |
| Note Editor | `/w/:id/g/:gid/n/:nid` | Editor, Toolbar, SaveStatus, AIPanel |

### Settings Screens

| Screen | Route | Components |
|--------|-------|------------|
| Workspace Settings | `/w/:id/settings` | NameInput, DangerZone |
| Member Management | `/w/:id/members` | MemberList, InviteModal, RoleDropdown |
| User Settings | `/settings` | ProfileForm, PasswordReset |

### Responsive Breakpoints

| Breakpoint | Width | Layout Change |
|------------|-------|---------------|
| Mobile | < 640px | Single column, bottom nav |
| Tablet | 640-1024px | Collapsible sidebar |
| Desktop | > 1024px | Full three-column layout |

---

## 15. API Contracts

### REST Endpoints

#### Notes API

```
GET    /api/notes?groupId={id}      → Note[]
GET    /api/notes/:id               → Note
POST   /api/notes                   → Note
PATCH  /api/notes/:id               → Note
DELETE /api/notes/:id               → { success: boolean }
```

#### Groups API

```
GET    /api/groups?workspaceId={id} → Group[]
POST   /api/groups                  → Group
PATCH  /api/groups/:id              → Group
DELETE /api/groups/:id              → { success: boolean }
```

#### Workspaces API

```
GET    /api/workspaces              → Workspace[]
GET    /api/workspaces/:id          → Workspace
POST   /api/workspaces              → Workspace
PATCH  /api/workspaces/:id          → Workspace
DELETE /api/workspaces/:id          → { success: boolean }
```

#### Members API

```
GET    /api/workspaces/:id/members  → WorkspaceMember[]
POST   /api/workspaces/:id/invite   → WorkspaceMember
PATCH  /api/members/:id             → WorkspaceMember
DELETE /api/members/:id             → { success: boolean }
```

#### AI API

```
POST   /api/ai/summarize            → { summary: string }
POST   /api/ai/extract-actions      → { actions: string[] }
POST   /api/ai/suggest-titles       → { titles: string[] }
```

### Request/Response Examples

```typescript
// Create Note
POST /api/notes
Request: {
  title: "Meeting Notes",
  body: "Discussed Q4 roadmap...",
  groupId: "uuid",
  isPinned: false
}
Response: {
  id: "uuid",
  title: "Meeting Notes",
  body: "Discussed Q4 roadmap...",
  groupId: "uuid",
  createdBy: "user-uuid",
  updatedBy: "user-uuid",
  isPinned: false,
  isDeleted: false,
  createdAt: "2024-01-28T10:00:00Z",
  updatedAt: "2024-01-28T10:00:00Z"
}

// Error Response
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Title is required",
    details: { field: "title" }
  }
}
```

---

## 16. Technical Decisions

### Stack Overview

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React + TypeScript | Industry standard, strong ecosystem |
| Styling | Tailwind CSS | Utility-first, consistent design |
| State | React Query + Zustand | Server state + client state separation |
| Routing | React Router | Standard for React SPAs |
| Editor | TipTap | Extensible, React-native, collaborative-ready |
| Backend | Supabase | Auth, DB, Realtime, Storage in one |
| AI | OpenAI API | Best quality, reliable |
| Realtime | Supabase Realtime | Built-in, low latency |
| Hosting | Vercel/Lovable | Simple deployment |

### Decision Log

| Decision | Options Considered | Chosen | Why |
|----------|-------------------|--------|-----|
| Editor | TipTap, Lexical, Slate | TipTap | Best DX, collaborative extensions |
| Realtime | Pusher, Socket.io, Supabase | Supabase | Already using for DB |
| AI | OpenAI, Anthropic, Local | OpenAI | Best quality/speed ratio |
| Auth | Auth0, Clerk, Supabase | Supabase | Unified backend |

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP | < 2.5s | Core Web Vitals |
| FID | < 100ms | Core Web Vitals |
| CLS | < 0.1 | Core Web Vitals |
| TTI | < 3.5s | Lighthouse |
| Bundle size | < 200KB gzip | Build output |

---

## 17. Roadmap & Phases

### Phase 1: Foundation (Weeks 1-4)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Auth + Data Model | Login, signup, database schema |
| 2 | Core CRUD | Notes, groups, workspaces |
| 3 | Editor + Save | TipTap integration, auto-save |
| 4 | Polish + Testing | Bug fixes, responsive design |

**Exit Criteria:** User can sign up, create workspace/group/note, save reliably.

### Phase 2: Collaboration (Weeks 5-6)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 5 | Invites + Roles | Member management, permissions |
| 6 | Realtime | "New version" banner, presence |

**Exit Criteria:** Teams can collaborate with clear ownership and updates.

### Phase 3: AI (Weeks 7-8)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 7 | AI Backend | OpenAI integration, rate limiting |
| 8 | AI UI | Summary, actions, title suggestions |

**Exit Criteria:** AI features functional and useful.

### Phase 4: Polish (Weeks 9-10)

| Week | Focus | Deliverables |
|------|-------|--------------|
| 9 | UX Polish | Animations, empty states, onboarding |
| 10 | Performance | Optimization, error handling, analytics |

**Exit Criteria:** Production-ready MVP.

### Post-MVP Roadmap

| Quarter | Theme | Features |
|---------|-------|----------|
| Q2 | Expand | Search, tags, templates, mobile app |
| Q3 | Integrate | Slack integration, API access, webhooks |
| Q4 | Scale | Enterprise features, SSO, audit logs |

---

## 18. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Editor complexity | Medium | High | Use proven library (TipTap) |
| Realtime sync issues | Medium | High | Thorough testing, graceful fallback |
| AI rate limits | Low | Medium | Caching, rate limiting, fallbacks |
| Performance at scale | Low | High | Early optimization, monitoring |

### Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Refresh-on-save confusion | Medium | Medium | Clear UI, user education |
| Password reset deliverability | Medium | Low | Retry flow, clear resend UX |
| AI trust issues | Low | Medium | Show sources, allow dismiss |
| Feature creep | High | Medium | Strict scope management |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low adoption | Medium | High | Focus on time-to-value |
| Churn | Medium | Medium | Engagement features, notifications |
| Competition | Medium | Medium | Differentiate on simplicity |

---

## 19. Open Questions

### To Resolve Before MVP

| # | Question | Owner | Deadline | Status |
|---|----------|-------|----------|--------|
| 1 | Final pricing tiers | Product | Week 2 | 🟡 Open |
| 2 | Offline behavior | Engineering | Week 3 | 🟡 Open |
| 3 | Note export formats | Product | Week 4 | 🟡 Open |
| 4 | Analytics events list | Product | Week 2 | 🟡 Open |

### Post-MVP Considerations

| # | Question | Notes |
|---|----------|-------|
| 1 | Mobile app approach | PWA vs Native? |
| 2 | API for integrations | Public API timeline? |
| 3 | Self-hosted option | Enterprise demand? |
| 4 | Collaborative editing | Full CRDT implementation? |

---

## 20. Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-01-28 | Initial MVP specification | Product Team |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Workspace** | Top-level container for a team or project |
| **Group** | Collection of related notes within a workspace |
| **Note** | Individual content unit with title and body |
| **CRDT** | Conflict-free replicated data type (not used in MVP) |
| **Refresh-on-save** | Collaboration model where saves trigger notifications |

## Appendix B: Competitive Analysis

| App | Strength | Weakness | TeamPad Opportunity |
|-----|----------|----------|---------------------|
| Notion | Feature-rich | Complex, slow | Simplicity, speed |
| Obsidian | Local-first | Poor collaboration | Team-first approach |
| Slite | Team-focused | Expensive | Better pricing |
| Dropbox Paper | Simple | Abandoned feel | Active development |

## Appendix C: User Research Insights

> *To be populated after user interviews*

| Finding | Frequency | Impact | Action |
|---------|-----------|--------|--------|
| TBD | TBD | TBD | TBD |

---

**Document Status:** Living document. Update as decisions are made.

**Review Cadence:** Weekly during MVP development, monthly post-launch.
