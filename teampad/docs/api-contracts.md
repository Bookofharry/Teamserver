# TeamPad API Contracts (Draft)

Base URL: `https://<your-api-host>/v1`

Auth:
- Default: HTTP-only session cookie set by `POST /auth/login` or `POST /auth/signup`.
- Optional: `Authorization: Bearer <jwt>` for server-to-server calls.

Timestamps: ISO 8601 strings in UTC.

## Pagination
Most list endpoints accept `?limit=<n>&offset=<n>`.
- Defaults: notes = 50, all other lists = 20
- Max limit: 200

## Idempotency
The following POST endpoints accept `Idempotency-Key` header to prevent duplicate creates:
- `POST /workspaces`
- `POST /workspaces/:id/groups`
- `POST /workspaces/:id/notes`
- `POST /workspaces/:id/invites`

Notes:
- Keys are capped at 128 characters.
- Stored keys expire automatically (default 7 days via `IDEMPOTENCY_TTL_DAYS`).
- Reusing a key while a request is in-flight returns `409` with `idempotency_in_progress`.

## Auth

### POST /auth/check-email
Request
```json
{ "email": "alex@teampad.io" }
```
Response
```json
{ "data": { "exists": false } }
```

### POST /auth/signup/request
Sends a 6-digit email verification code.

Request
```json
{ "email": "alex@teampad.io" }
```
Response
```json
{ "data": { "sent": true } }
```

### POST /auth/signup/verify
Creates a user after OTP verification and sets a session cookie.

Request
```json
{ "name": "Alex Johnson", "email": "alex@teampad.io", "password": "password123", "code": "123456" }
```
Response
```json
{ "data": { "userId": "user_1", "email": "alex@teampad.io" } }
```

### POST /auth/login
Creates a session cookie.

Request
```json
{ "email": "alex@teampad.io", "password": "password123" }
```
Response
```json
{ "data": { "userId": "user_1", "email": "alex@teampad.io" } }
```

### POST /auth/logout
Response
```json
{ "data": { "cleared": true } }
```

### POST /auth/forgot-password
Request
```json
{ "email": "alex@teampad.io" }
```
Response
```json
{ "data": { "sent": true } }
```

### POST /auth/reset-password
Request
```json
{ "token": "reset_token", "password": "newpassword123" }
```
Response
```json
{ "data": { "updated": true } }
```

## Profile

### GET /me
Response
```json
{
  "data": {
    "id": "user_1",
    "name": "Alex Johnson",
    "email": "alex@teampad.io",
    "avatar": null,
    "plan": "free",
    "isSubscribed": false
  }
}
```

### PATCH /me
Request
```json
{ "name": "Alex Johnson", "avatar": "https://..." }
```
Response
```json
{
  "data": {
    "id": "user_1",
    "name": "Alex Johnson",
    "email": "alex@teampad.io",
    "avatar": "https://...",
    "plan": "free",
    "isSubscribed": false
  }
}
```

## Workspaces

### GET /workspaces
Response
```json
{
  "data": [
    {
      "id": "ws_123",
      "name": "Harry Dev",
      "ownerId": "user_1",
      "createdAt": "2025-01-28T10:22:00.000Z"
    }
  ]
}
```

### POST /workspaces
Request
```json
{ "name": "Harry Dev" }
```
Response
```json
{
  "data": {
    "id": "ws_123",
    "name": "Harry Dev",
    "ownerId": "user_1",
    "createdAt": "2025-01-28T10:22:00.000Z"
  }
}
```

### PATCH /workspaces/:id
Request
```json
{ "name": "New Workspace Name" }
```
Response
```json
{
  "data": {
    "id": "ws_123",
    "name": "New Workspace Name",
    "ownerId": "user_1",
    "createdAt": "2025-01-28T10:22:00.000Z"
  }
}
```

### DELETE /workspaces/:id
Response
```json
{ "data": { "id": "ws_123" } }
```

## Members & Invites

### GET /workspaces/:id/members
Response
```json
{
  "data": [
    {
      "id": "wm_1",
      "workspaceId": "ws_123",
      "userId": "user_1",
      "role": "owner",
      "joinedAt": "2025-01-20T09:00:00.000Z",
      "user": {
        "id": "user_1",
        "name": "Alex Johnson",
        "email": "alex@teampad.io",
        "avatar": null,
        "plan": "free",
        "isSubscribed": false
      }
    }
  ]
}
```

### GET /workspaces/:id/invites
Response
```json
{
  "data": [
    {
      "id": "inv_1",
      "workspaceId": "ws_123",
      "email": "new@teampad.io",
      "role": "member",
      "token": "invite_token_abc",
      "expiresAt": "2025-02-04T10:22:00.000Z",
      "createdBy": "user_1",
      "createdAt": "2025-01-28T10:22:00.000Z"
    }
  ]
}
```

### POST /workspaces/:id/invites
Request
```json
{ "email": "new@teampad.io", "role": "member" }
```
Response
```json
{
  "data": {
    "id": "inv_1",
    "workspaceId": "ws_123",
    "email": "new@teampad.io",
    "role": "member",
    "token": "invite_token_abc",
    "expiresAt": "2025-02-04T10:22:00.000Z",
    "createdBy": "user_1",
    "createdAt": "2025-01-28T10:22:00.000Z"
  }
}
```

### DELETE /workspaces/:id/members/:userId
Response
```json
{ "data": { "workspaceId": "ws_123", "userId": "user_2" } }
```

## Invite Flow

### GET /invites/:token
Response
```json
{
  "data": {
    "id": "inv_1",
    "workspaceId": "ws_123",
    "workspaceName": "TeamPad",
    "email": "new@teampad.io",
    "role": "member",
    "token": "invite_token_abc",
    "expiresAt": "2025-02-04T10:22:00.000Z",
    "createdAt": "2025-01-28T10:22:00.000Z",
    "inviter": {
      "id": "user_1",
      "name": "Alex Johnson",
      "email": "alex@teampad.io",
      "avatar": null,
      "plan": "free",
      "isSubscribed": false
    }
  }
}
```

### GET /invites
Lists pending invites for the signed-in user.

Response
```json
{
  "data": [
    {
      "id": "inv_1",
      "workspaceId": "ws_123",
      "workspaceName": "TeamPad",
      "email": "new@teampad.io",
      "role": "member",
      "token": "invite_token_abc",
      "expiresAt": "2025-02-04T10:22:00.000Z",
      "createdAt": "2025-01-28T10:22:00.000Z",
      "inviter": {
        "id": "user_1",
        "name": "Alex Johnson",
        "email": "alex@teampad.io",
        "avatar": null,
        "plan": "free",
        "isSubscribed": false
      }
    }
  ]
}
```

### POST /invites/:token/accept
Response
```json
{
  "data": {
    "workspaceId": "ws_123",
    "member": {
      "id": "wm_2",
      "userId": "user_2",
      "role": "member"
    }
  }
}
```

### POST /invites/:token/decline
Response
```json
{ "data": { "workspaceId": "ws_123", "email": "new@teampad.io" } }
```

## Collections (Groups)

### GET /workspaces/:id/groups
Response
```json
{
  "data": [
    {
      "id": "grp_1",
      "workspaceId": "ws_123",
      "name": "Marketing",
      "color": "#0EA5E9",
      "noteCount": 12
    }
  ]
}
```

### POST /workspaces/:id/groups
Request
```json
{ "name": "Marketing", "color": "#0EA5E9" }
```
Response
```json
{
  "data": {
    "id": "grp_1",
    "workspaceId": "ws_123",
    "name": "Marketing",
    "color": "#0EA5E9",
    "noteCount": 0
  }
}
```

### DELETE /workspaces/:id/groups/:groupId
Response
```json
{ "data": { "id": "grp_1" } }
```

## Notes

### GET /workspaces/:id/notes?groupId=:groupId&query=:query
Notes:
- `groupId` filters to a collection when `query` is not provided.
- `query` searches title/body (and tags for single-word queries).
Response
```json
{
  "data": [
    {
      "id": "note_1",
      "workspaceId": "ws_123",
      "groupId": "grp_1",
      "title": "Q1 Marketing Strategy",
      "body": "...",
      "tags": ["strategy", "q1"],
      "isPinned": true,
      "isPublic": false,
      "publicSlug": null,
      "publicPublishedAt": null,
      "publicExpiresAt": null,
      "updatedBy": {
        "id": "user_1",
        "name": "Alex Johnson",
        "email": "alex@teampad.io",
        "avatar": null,
        "plan": "free",
        "isSubscribed": false
      },
      "createdAt": "2025-01-20T09:00:00.000Z",
      "updatedAt": "2025-01-28T10:22:00.000Z"
    }
  ]
}
```

### POST /workspaces/:id/notes
Request
```json
{
  "groupId": "grp_1",
  "title": "Untitled",
  "body": "",
  "tags": []
}
```
Response
```json
{
  "data": {
    "id": "note_2",
    "workspaceId": "ws_123",
    "groupId": "grp_1",
    "title": "Untitled",
    "body": "",
    "tags": [],
    "isPinned": false,
    "isPublic": false,
    "publicSlug": null,
    "publicPublishedAt": null,
    "publicExpiresAt": null,
    "updatedBy": {
      "id": "user_1",
      "name": "Alex Johnson",
      "email": "alex@teampad.io",
      "avatar": null,
      "plan": "free",
      "isSubscribed": false
    },
    "createdAt": "2025-01-28T10:22:00.000Z",
    "updatedAt": "2025-01-28T10:22:00.000Z"
  }
}
```

### PATCH /notes/:id
Request
```json
{
  "title": "Updated title",
  "body": "Updated body",
  "tags": ["updated"],
  "isPinned": false,
  "groupId": "grp_1"
}
```
Response
```json
{
  "data": {
    "id": "note_1",
    "workspaceId": "ws_123",
    "groupId": "grp_1",
    "title": "Updated title",
    "body": "Updated body",
    "tags": ["updated"],
    "isPinned": false,
    "isPublic": false,
    "publicSlug": null,
    "publicPublishedAt": null,
    "publicExpiresAt": null,
    "updatedBy": {
      "id": "user_1",
      "name": "Alex Johnson",
      "email": "alex@teampad.io",
      "avatar": null,
      "plan": "free",
      "isSubscribed": false
    },
    "createdAt": "2025-01-20T09:00:00.000Z",
    "updatedAt": "2025-01-28T10:25:00.000Z"
  }
}
```

### POST /notes/:id/toggle-pin
Response
```json
{
  "data": {
    "id": "note_1",
    "workspaceId": "ws_123",
    "groupId": "grp_1",
    "title": "Updated title",
    "body": "Updated body",
    "tags": ["updated"],
    "isPinned": true,
    "isPublic": false,
    "publicSlug": null,
    "publicPublishedAt": null,
    "publicExpiresAt": null,
    "updatedBy": {
      "id": "user_1",
      "name": "Alex Johnson",
      "email": "alex@teampad.io",
      "avatar": null,
      "plan": "free",
      "isSubscribed": false
    },
    "createdAt": "2025-01-20T09:00:00.000Z",
    "updatedAt": "2025-01-28T10:25:00.000Z"
  }
}
```

### PATCH /notes/:id/public
Toggles public access for a note (Premium+ only).

Request
```json
{ "isPublic": true }
```
Response
```json
{
  "data": {
    "id": "note_1",
    "isPublic": true,
    "publicSlug": "note_abc",
    "publicPublishedAt": "2025-01-28T10:22:00.000Z",
    "publicExpiresAt": "2025-02-27T10:22:00.000Z"
  }
}
```

### DELETE /notes/:id
Response
```json
{ "data": { "id": "note_1" } }
```

## Public Notes

### GET /public/notes/:slug
Response
```json
{
  "data": {
    "id": "note_1",
    "title": "Q1 Marketing Strategy",
    "body": "...",
    "updatedAt": "2025-01-28T10:22:00.000Z",
    "updatedBy": {
      "id": "user_1",
      "name": "Alex Johnson",
      "avatar": null
    },
    "publicSlug": "note_abc",
    "publicExpiresAt": "2025-02-27T10:22:00.000Z"
  }
}
```

## Billing

### POST /upgrade-intents
Request
```json
{ "plan": "premium", "source": "pricing" }
```
Response
```json
{
  "data": {
    "id": "up_1",
    "plan": "premium",
    "status": "pending",
    "createdAt": "2025-01-28T10:22:00.000Z",
    "alreadyPending": false
  }
}
```

## Error Shape
```json
{
  "error": {
    "code": "unauthorized",
    "message": "Invalid or expired token"
  }
}
```
