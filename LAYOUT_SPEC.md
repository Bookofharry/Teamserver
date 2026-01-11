# TeamPad Layout Specification (Improved)

Version: 2.0
Scope: Desktop + Tablet + Mobile

## 1) Layout Grid and Spacing
- Base grid: 4px
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40
- Radius: 10px (default), 14px (cards), 20px (panels)
- Borders: hairline only, 0.5px or 1px max
- Typography: strong section labels, calm body text

## 2) Breakpoints
- Desktop: >= 1280px
- Laptop: 1024px to 1279px
- Tablet: 768px to 1023px
- Mobile: <= 767px

## 3) Global Structure (Improved)
- Header (top bar): always visible, primary actions
- Sidebar: collapsible by default on login
- Notes list: resizable, with clear note density controls
- Editor: stable outer frame + inner writing frame
- Right panels: Chat and AI as overlays, not permanent columns

## 4) Desktop Layout (Improved)

### 4.1 Header (top)
Height: 64px
Background: primary (matches homepage)
Left to right:
1) Workspace switcher (name + dropdown)
2) Global quick actions (AI, Chat)
3) Notifications
4) Profile / Settings

Notes:
- No gradients in productivity view.
- Only essential icons are visible; secondary actions moved to menus.

### 4.2 Sidebar (left)
Width: 256px expanded, 64px collapsed
Default: collapsed on login
Sections:
- Logo / brand icon
- Workspace switcher (dropdown)
- Search input
- Collections list
- Create collection button
- Footer (plan badge, settings link)

### 4.3 Notes List Panel
Width: 360px default (resize 280–560)
Structure:
- Header: count + create note
- Optional filter row
- Note cards (no heavy borders)

### 4.4 Note Editor (main)
Stable layout with two frames:
- Outer frame: fixed container, never resizes with content
- Inner frame: writing surface

Editor Stack:
1) Toolbar (formatting + actions)
2) Title input
3) Tag row
4) Meta row
5) Editor frames
6) Attachments block

### 4.5 Chat Panel (overlay)
Width: 44rem–60rem
Sections:
- Header: Workspace Chat + Realtime status + Close
- Message stream
- Composer

Rules:
- Unread clears immediately on open
- Soft-delete shows placeholder
- No message edit

### 4.6 AI Panel (overlay)
Width: 28rem
Sections:
- Header
- Conversation stream
- Prompt input

## 5) Tablet Layout (Improved)
- Sidebar collapses by default
- Notes list and editor stack vertically
- Chat/AI open full-height overlays
- Header always visible

## 6) Mobile Layout (Improved)
- Sidebar hidden; workspace switcher in header
- Notes list in sheet or separate view
- Editor full screen
- Chat full screen
- AI panel full screen

## 7) Icon Placement and Sizes
- Header icons: 20px
- Sidebar icons: 18px
- Note toolbar icons: 16px
- Chat action icons: 18px
- Avatar circles: 28px

## 8) Interaction Rules
- Sidebar collapses on login (desktop)
- Default collection on login: General Collection
- Chat unread clears on open
- Soft-delete messages (placeholder)
- No message edit
- Placeholder hides on focus in note editor and chat input

## 9) Required Screens
- Auth (Login, Signup, OTP, Reset)
- Dashboard (Notes)
- Chat
- AI Panel
- Settings
- Admin (if enabled)

## 10) Wireframe Outlines (ASCII)

### 10.1 Desktop Dashboard
+----------------------------------------------------------------------------------+
| Header: [Workspace ▼] [AI] [Chat] [Notifications] [Profile]                      |
+----------------------------------------------------------------------------------+
| Sidebar (collapsed) | Notes List Panel        | Note Editor                      |
| - Logo              | - Notes header          | - Toolbar                         |
| - Switcher          | - Notes list            | - Title                           |
| - Search            |                         | - Tags                            |
| - Collections       |                         | - Meta                            |
| - Footer            |                         | - Editor (outer + inner frame)    |
|                     |                         | - Attachments                     |
+----------------------------------------------------------------------------------+

### 10.2 Desktop Chat Overlay
+----------------------------------------------------------------------------------+
| [Workspace Chat] [Realtime active]                                [Close]       |
+----------------------------------------------------------------------------------+
| Messages list (scroll)                                                           |
| - Unread divider                                                                 |
| - Soft-delete placeholder                                                        |
+----------------------------------------------------------------------------------+
| Composer: [Textarea] [Add photo] [Send]                                          |
+----------------------------------------------------------------------------------+

### 10.3 Desktop AI Panel Overlay
+----------------------------------------------------------------------------------+
| [AI Assistant]                                                    [Close]        |
+----------------------------------------------------------------------------------+
| Conversation stream (scroll)                                                      |
+----------------------------------------------------------------------------------+
| Prompt input [Ask]                                                                |
+----------------------------------------------------------------------------------+

### 10.4 Tablet
+---------------------------------------------+
| Header                                      |
+---------------------------------------------+
| Notes list + editor stacked                 |
+---------------------------------------------+
| Chat / AI overlays                          |
places where general collections likely shows
General Collection+---------------------------------------------+

### 10.5 Mobile
+---------------------------------------------+
| Header (workspace + actions)                |
+---------------------------------------------+
| Notes list (sheet / view)                   |
+---------------------------------------------+
| Editor full screen                          |
+---------------------------------------------+
| Chat full screen                            |
+---------------------------------------------+

## 11) Pixel-Level Specs (Detailed)

### 11.1 Header
- Height: 64px
- Padding: 0 24px
- Workspace switcher: left aligned, max width 240px
- Action icon group spacing: 12px
- Profile avatar: 32px

### 11.2 Sidebar
- Expanded width: 256px
- Collapsed width: 64px
- Section padding: 16px
- Item height: 36px
- Icon size: 18px
- Collapse toggle: top-right of sidebar, 32px hit area

### 11.3 Notes List Panel
- Default width: 360px
- Min: 280px, Max: 560px
- Header height: 52px
- Note card padding: 16px
- Note card gap: 8px

### 11.4 Editor
- Outer frame padding: 12px
- Inner frame padding: 16px
- Title input size: 28px font, line height 1.2
- Tag row height: auto, min 36px
- Meta row height: 24px
- Editor min height: 360px

### 11.5 Chat Panel
- Width: 44rem–60rem (responsive)
- Header height: 64px
- Message bubble max width: 85%
- Composer min height: 72px
- Action button hit area: 32px

### 11.6 AI Panel
- Width: 28rem
- Header height: 56px
- Prompt input height: 40px

### 11.7 Tablet
- Sidebar hidden by default
- Notes list width: full
- Editor width: full

### 11.8 Mobile
- Header height: 56px
- Panels: full screen overlays
- Bottom padding on composer: 16px

