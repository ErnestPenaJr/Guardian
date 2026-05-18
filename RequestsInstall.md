# RequestsInstall.md — Requests Feature for .NET 8/9 ASP.NET Core Port

> **Audience:** Claude Code working in a .NET 8/9 + ASP.NET Core Web API + Entity Framework Core target project.
> **Source:** Guardian MVP (Node/Express/Prisma) — `/Users/epena/Desktop/www/projects/Guardian MVP/`.
> **Goal:** Port the **Requests** feature (request lifecycle, assignment, tasks, work progress, attachments) while keeping the React frontend unchanged.

**Prerequisites in the target project** (do not re-document, just verify they exist):
- JWT auth + `CompanyScopingMiddleware` + `HttpContext.CompanyId()` / `UserId()` / `UserRoleIds()` / `IsAdmin()` extensions — see **FormBuilderInstall.md §4**
- `GuardianDbContext` with `HasDefaultSchema("GUARDIAN")` — see **FormBuilderInstall.md §3**
- `FORMS`, `FIELDS`, `FORMS_INSTANCE`, `FORMS_INSTANCE_VALUES` tables + endpoints — see **FormBuilderInstall.md**
- `System.Text.Json` configured with `PropertyNamingPolicy = null` so payloads keep `ALL_CAPS_SNAKE_CASE` keys

If those don't exist yet, install **FormBuilderInstall.md first** — this doc depends on it.

---

## 0. Definition of done

- [ ] EF Core models for `REQUESTS`, `TASKS`, `WORK_PROGRESS`, `ATTACHMENTS`, `NOTIFICATIONS` exist in the `GUARDIAN` schema and migrations apply cleanly.
- [ ] `TRACKINGID` is a SQL Server **computed column** on both `REQUESTS` and `TASKS` — never written from app code.
- [ ] `STATUS` lifecycle (`P` → `A` → `D` | `X`) works exactly as described in §3.4. Default for new requests is `P`, **not** `A`.
- [ ] All 20 endpoints in §6 return the documented JSON shapes and pass company-isolation checks.
- [ ] Permission policies `RequestsViewAll`, `RequestsAssign`, `RequestsStart`, `RequestsComplete`, `RequestsTasks` are registered and applied (see §5).
- [ ] Notifications row created on every assignment (request and task) AND email is fired via the email service.
- [ ] Email failures do **not** roll back DB writes — log and continue.
- [ ] Task creation tolerates `ASSIGNED_USER_ID = NULL` (server-side workaround for schema bug — see Pitfall #2).
- [ ] Frontend smoke test passes — see §11.

---

## 1. Tech stack additions

Already-installed packages from FormBuilderInstall.md are sufficient. Optionally add:

```bash
dotnet add package Microsoft.AspNetCore.SignalR        # if you want live notifications later
```

Email provider: same as Notices feature (Resend or your transactional provider). Reuse the email-service abstraction.

---

## 2. Project additions

Add to the existing structure (do not duplicate Form/Auth scaffolding):

```
Guardian.Api/
├── Controllers/
│   ├── RequestsController.cs
│   ├── TasksController.cs
│   ├── WorkProgressController.cs
│   ├── AttachmentsController.cs            # /api/requests/{id}/attachments
│   └── NotificationsController.cs           # already exists per CLAUDE.md if not, add it
├── Data/Configurations/
│   ├── RequestConfiguration.cs
│   ├── TaskConfiguration.cs
│   ├── WorkProgressConfiguration.cs
│   ├── AttachmentConfiguration.cs
│   └── NotificationConfiguration.cs
├── Models/Entities/
│   ├── Request.cs
│   ├── TaskItem.cs        # avoid clashing with System.Threading.Tasks.Task
│   ├── WorkProgress.cs
│   ├── Attachment.cs
│   └── Notification.cs
├── Models/Dtos/
│   ├── CreateRequestDto.cs
│   ├── RequestDto.cs
│   ├── AssignRequestDto.cs
│   ├── StartCompleteCancelDtos.cs
│   ├── CreateTaskDto.cs, UpdateTaskDto.cs, TaskDto.cs
│   └── WorkProgressDto.cs
├── Services/
│   ├── IRequestService.cs / RequestService.cs
│   ├── ITaskService.cs    / TaskService.cs
│   ├── IWorkProgressService.cs / WorkProgressService.cs
│   ├── IAttachmentService.cs   / AttachmentService.cs
│   ├── INotificationService.cs / NotificationService.cs
│   ├── IEmailService.cs        / EmailService.cs   # already exists if Notices was ported
│   └── IMilestoneService.cs    / MilestoneService.cs   # wraps WORK_PROGRESS writes for system events
└── Auth/Policies.cs        # add new policies (see §5)
```

---

## 3. Database schema (EF Core)

### 3.1 `REQUESTS` — primary lifecycle table

```csharp
public class Request
{
    public int RequestId { get; set; }
    public string RequestName { get; set; } = null!;              // VARCHAR(255)
    public string? ExternalUser { get; set; } = "N";              // CHAR(1)
    public DateTime SubmittedDate { get; set; }                   // GETDATE() default
    public int? RequestorId { get; set; }                         // FK USERS
    public int? AssignedId { get; set; }                          // FK USERS
    public string? Status { get; set; } = "P";                    // CHAR(1) — see §3.4
    public DateTime CreateDate { get; set; }
    public DateTime? UpdateDate { get; set; }
    public int? CreateUserId { get; set; }
    public int? UpdateUserId { get; set; }
    public string? TrackingId { get; set; }                       // NVARCHAR(4000) — COMPUTED, read-only
    public string? Abbreviation { get; set; }                     // VARCHAR(5)
    public decimal? CompanyId { get; set; }                       // DECIMAL(38,0) in source (yes, decimal — see Pitfall #1)
    public string? RequestDescription { get; set; }               // VARCHAR(2000)
    public string? ResultsDescription { get; set; }               // VARCHAR(4000)
    public int? FormId { get; set; }                              // FK FORMS
    public string PriorityLevel { get; set; } = "Standard";       // NVARCHAR(10) — CHK ('Low','Standard','High')
    public int? WorkspaceId { get; set; }
    public string? CancellationReason { get; set; }               // NVARCHAR(500)
    public DateTime? CancelledDate { get; set; }
    public int? CancelledBy { get; set; }                         // FK USERS

    // Navigations
    public Form? Form { get; set; }
    public User? Requestor { get; set; }
    public User? AssignedUser { get; set; }
    public User? CancelledByUser { get; set; }
    public ICollection<WorkProgress> WorkProgress { get; set; } = new List<WorkProgress>();
}
```

**EF configuration highlights:**

```csharp
b.ToTable("REQUESTS", "GUARDIAN");
b.HasKey(x => x.RequestId).HasName("PK_REQUESTS");
b.Property(x => x.RequestId).HasColumnName("REQUEST_ID");
b.Property(x => x.RequestName).HasColumnName("REQUEST_NAME").HasMaxLength(255);
b.Property(x => x.Status).HasColumnName("STATUS").HasMaxLength(1).HasDefaultValue("A");  // see Pitfall #4
b.Property(x => x.TrackingId)
    .HasColumnName("TRACKINGID")
    .ValueGeneratedOnAddOrUpdate()
    .Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);  // computed column
b.Property(x => x.CompanyId).HasColumnName("COMPANY_ID").HasColumnType("decimal(38,0)");
b.Property(x => x.PriorityLevel).HasColumnName("PRIORITY_LEVEL").HasMaxLength(10).HasDefaultValue("Standard");
b.Property(x => x.SubmittedDate).HasColumnName("SUBMITTED_DATE").HasDefaultValueSql("GETDATE()");
b.Property(x => x.CreateDate).HasColumnName("CREATE_DATE").HasDefaultValueSql("GETDATE()");
b.Property(x => x.UpdateDate).HasColumnName("UPDATE_DATE").HasDefaultValueSql("GETDATE()");
b.Property(x => x.ExternalUser).HasColumnName("EXTERNAL_USER").HasMaxLength(1).HasDefaultValue("N");

// Check constraints (preserve existing — do NOT regenerate)
b.ToTable(tb =>
{
    tb.HasCheckConstraint("CHK_REQUESTS_PRIORITY_LEVEL", "[PRIORITY_LEVEL] IN ('Low','Standard','High')");
    tb.HasCheckConstraint("CHK_REQUESTS_CANCELLATION_FIELDS",
        "([STATUS] = 'X' AND [CANCELLED_DATE] IS NOT NULL AND [CANCELLED_BY] IS NOT NULL) OR " +
        "([STATUS] <> 'X' AND [CANCELLED_DATE] IS NULL AND [CANCELLED_BY] IS NULL AND [CANCELLATION_REASON] IS NULL)");
});

b.HasOne(x => x.Requestor).WithMany().HasForeignKey(x => x.RequestorId).OnDelete(DeleteBehavior.NoAction);
b.HasOne(x => x.AssignedUser).WithMany().HasForeignKey(x => x.AssignedId).OnDelete(DeleteBehavior.NoAction);
b.HasOne(x => x.CancelledByUser).WithMany().HasForeignKey(x => x.CancelledBy).OnDelete(DeleteBehavior.NoAction);
b.HasOne(x => x.Form).WithMany().HasForeignKey(x => x.FormId).OnDelete(DeleteBehavior.NoAction);
```

### 3.2 `TASKS`

```csharp
public class TaskItem
{
    public int TaskId { get; set; }
    public int RequestId { get; set; }
    public string Status { get; set; } = "Pending";    // VARCHAR(20) — see §3.5
    public int? AssignedUserId { get; set; }           // schema is NOT NULL but code allows null — see Pitfall #2
    public string? Description { get; set; }           // VARCHAR(250)
    public int? CreateUserId { get; set; }
    public int? UpdateUserId { get; set; }
    public DateTime CreateDate { get; set; }
    public DateTime UpdateDate { get; set; }
    public string? TrackingId { get; set; }            // COMPUTED column, read-only

    public Request Request { get; set; } = null!;
}
```

```csharp
b.ToTable("TASKS", "GUARDIAN");
b.HasKey(x => x.TaskId).HasName("PK_TASKS");
b.Property(x => x.TaskId).HasColumnName("TASK_ID");
b.Property(x => x.RequestId).HasColumnName("REQUEST_ID");
b.Property(x => x.Status).HasColumnName("STATUS").HasMaxLength(20);
b.Property(x => x.AssignedUserId).HasColumnName("ASSIGNED_USER_ID");   // see Pitfall #2
b.Property(x => x.Description).HasColumnName("DESCRIPTION").HasMaxLength(250);
b.Property(x => x.TrackingId)
    .HasColumnName("TRACKINGID")
    .ValueGeneratedOnAddOrUpdate()
    .Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);
b.Property(x => x.CreateDate).HasColumnName("CREATE_DATE").HasDefaultValueSql("GETDATE()");
b.Property(x => x.UpdateDate).HasColumnName("UPDATE_DATE").HasDefaultValueSql("GETDATE()");
b.HasOne(x => x.Request).WithMany().HasForeignKey(x => x.RequestId).OnDelete(DeleteBehavior.NoAction);
```

### 3.3 `WORK_PROGRESS` — milestones, notes, status timeline

```csharp
public class WorkProgress
{
    public int WorkProgressId { get; set; }
    public int RequestId { get; set; }
    public int UserId { get; set; }
    public int CompanyId { get; set; }
    public string ProgressType { get; set; } = "note";   // 'note'|'milestone'|'status'|'task'|'document'|'form'|'system'
    public string Title { get; set; } = null!;           // VARCHAR(255)
    public string? Description { get; set; }             // VARCHAR(2000)
    public decimal? HoursWorked { get; set; }            // DECIMAL(5,2)
    public string? StatusUpdate { get; set; }            // VARCHAR(100)
    public int? RelatedAttachmentId { get; set; }
    public int? RelatedTaskId { get; set; }
    public bool IsMilestone { get; set; }
    public bool IsVisibleToRequestor { get; set; } = true;
    public bool IsSystemGenerated { get; set; }
    public string? StatusFrom { get; set; }              // for status change events
    public string? StatusTo { get; set; }
    public string? EventData { get; set; }               // VARCHAR(4000) — JSON blob
    public DateTime CreateDate { get; set; }
    public DateTime UpdateDate { get; set; }
    public int? CreateUserId { get; set; }
    public int? UpdateUserId { get; set; }

    public Request Request { get; set; } = null!;
}
```

### 3.4 Request `STATUS` lifecycle

| Value | Name | Meaning | Allowed transitions |
|---|---|---|---|
| `P` | Pending | New request, not started | → `A` (start), → `X` (cancel) |
| `A` | Active | In progress | → `D` (complete), → `X` (cancel) |
| `D` | Done | Completed | terminal |
| `X` | Cancelled | Cancelled | terminal (must populate `CANCELLED_DATE`, `CANCELLED_BY`) |

**On create**: server-side force `STATUS = 'P'`. Do not trust client.
**On `/start`**: `P → A`. Only if caller is assignee (or request is unassigned, in which case auto-assign to caller).
**On `/complete`**: `A → D`. Same assignee rule.
**On `/cancel`**: any active state → `X`. Set `CANCELLED_DATE = GETDATE()` and `CANCELLED_BY = userId` atomically — the DB check constraint will reject the row otherwise.

### 3.5 Task `STATUS` lifecycle

| Value | Allowed transitions |
|---|---|
| `Pending` | → `In Progress`, → `Completed`, → `Cancelled` |
| `In Progress` | → `Completed` |
| `Completed` | terminal |
| `Cancelled` | terminal (only Pending can be cancelled) |

Server validates transitions; reject 409 if invalid. **Only `Pending` tasks can be deleted.**

### 3.6 `ATTACHMENTS` and `NOTIFICATIONS`

`ATTACHMENTS` schema is documented in **notices.md §3.6** — same table, reused. `REQUEST_ID` column holds the request id for request-related uploads.

`NOTIFICATIONS` — used for in-app inbox. Minimum columns:

```csharp
public class Notification
{
    public int NotificationId { get; set; }
    public int UserId { get; set; }                  // recipient
    public string Type { get; set; } = null!;        // 'assignment' | 'task_assigned' | 'request_cancelled'
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public int? RelatedId { get; set; }              // REQUEST_ID or TASK_ID
    public int CompanyId { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime? ReadDate { get; set; }          // null = unread
}
```

---

## 4. Tracking ID (computed column) — IMPORTANT

The Node source treats `TRACKINGID` as auto-generated by the database. EF Core must **never write it**. To enforce that, both entity configurations above use:

```csharp
.ValueGeneratedOnAddOrUpdate()
.Metadata.SetAfterSaveBehavior(PropertySaveBehavior.Ignore);
```

After `SaveChanges()`, refetch the entity to populate `TrackingId`:

```csharp
context.Add(request);
await context.SaveChangesAsync();
await context.Entry(request).ReloadAsync();   // pulls TRACKINGID from DB
```

### 4.1 Provisioning the computed column

If the column does not yet exist in your target DB, add it in a migration:

```sql
-- For REQUESTS
ALTER TABLE GUARDIAN.REQUESTS ADD TRACKINGID AS ('REQ-' + CAST(REQUEST_ID AS VARCHAR(10))) PERSISTED;

-- For TASKS
ALTER TABLE GUARDIAN.TASKS ADD TRACKINGID AS ('TSK-' + CAST(TASK_ID AS VARCHAR(10))) PERSISTED;
```

The frontend already falls back to `REQ-${REQUEST_ID}` / `TSK-${TASK_ID}` if the column is null, so the formula above produces frontend-compatible IDs. If your target DB uses a sequence + custom prefix, replicate that formula and update the migration. **Do not** generate trackingIds in app code — that race-conditions on concurrent inserts.

---

## 5. Permissions (extend FormBuilderInstall.md §4)

Add these policies in `Program.cs`:

```csharp
options.AddPolicy(Policies.RequestsCreate, p => p.RequireAuthenticatedUser());  // anyone authenticated
options.AddPolicy(Policies.RequestsViewAll,  p => p.RequireAssertion(c => HasAnyRole(c, 1, 3, 4, 6)));
options.AddPolicy(Policies.RequestsStart,    p => p.RequireAssertion(c => HasAnyRole(c, 1, 3, 4, 6)));
options.AddPolicy(Policies.RequestsComplete, p => p.RequireAssertion(c => HasAnyRole(c, 1, 3, 4, 6)));
options.AddPolicy(Policies.RequestsAssign,   p => p.RequireAssertion(c => HasAnyRole(c, 1, 4, 6)));
options.AddPolicy(Policies.RequestsTasks,    p => p.RequireAssertion(c => HasAnyRole(c, 1, 3, 4, 6)));
```

```csharp
static bool HasAnyRole(AuthorizationHandlerContext ctx, params int[] roles)
{
    var userRoles = ctx.User.FindAll("roles").Select(c => int.Parse(c.Value));
    return userRoles.Any(r => roles.Contains(r));
}

public static class Policies
{
    public const string RequestsCreate   = "RequestsCreate";
    public const string RequestsViewAll  = "RequestsViewAll";
    public const string RequestsStart    = "RequestsStart";
    public const string RequestsComplete = "RequestsComplete";
    public const string RequestsAssign   = "RequestsAssign";
    public const string RequestsTasks    = "RequestsTasks";
}
```

Role IDs are the same as elsewhere — `1` Admin, `2` User, `3` Processor, `4` Manager, `5` External, `6` Super Admin, `7` Finance.

---

## 6. Endpoints to implement

Match HTTP method + path **exactly** — the React service `src/services/requestService.ts` is hard-wired to these. All endpoints are `[Authorize]` (JWT required); company isolation via `WHERE COMPANY_ID = @companyId` is mandatory on every read AND write.

### 6.1 Request CRUD & lifecycle

| # | Method | Path | Policy | Purpose |
|---|---|---|---|---|
| 1 | GET | `/api/requests` | RequestsCreate (auth) | List requests caller can see (see §6.1.1 filter) |
| 2 | GET | `/api/requests/assigned/me` | RequestsCreate | Requests assigned to caller and `STATUS = 'A'` |
| 3 | GET | `/api/requests/{id}` | RequestsCreate | Single request with joined user info |
| 4 | POST | `/api/requests` | RequestsCreate | Create request (+ optional form instance) |
| 5 | PUT | `/api/requests/{requestId}/assign` | RequestsAssign | Assign or unassign |
| 6 | POST | `/api/requests/{id}/start` | RequestsStart | `P → A` (auto-assign if unassigned) |
| 7 | POST | `/api/requests/{id}/complete` | RequestsComplete | `A → D` |
| 8 | POST | `/api/requests/{id}/cancel` | RequestsCreate | `* → X` (caller must be assignee OR requestor) |
| 9 | PUT | `/api/requests/{requestId}/description` | RequestsCreate | Update `RESULTS_DESCRIPTION` (≤4000 chars) |
| 10 | DELETE | `/api/requests/{id}` | RequestsCreate | Delete; rejects if `STATUS IN ('A','D','X')` |

#### 6.1.1 `GET /api/requests` — the row-visibility filter (critical)

```csharp
var companyId = HttpContext.CompanyId();
var userId    = HttpContext.UserId();
var workspaceId = await GetActiveWorkspaceIdAsync(userId);  // may be null

var q = db.Requests
    .Where(r => r.CompanyId == companyId);

// users see requests they CREATED, REQUESTED, or are ASSIGNED to
if (!HttpContext.UserHasPolicy(Policies.RequestsViewAll))
{
    q = q.Where(r =>
        r.CreateUserId == userId
     || r.RequestorId  == userId
     || r.AssignedId   == userId);
}

// workspace scoping
if (workspaceId.HasValue)
    q = q.Where(r => r.WorkspaceId == workspaceId || r.WorkspaceId == null);

var rows = await q
    .OrderByDescending(r => r.CreateDate)
    .Select(r => new RequestDto(...))   // see §7
    .ToListAsync()
    .WithTimeout(TimeSpan.FromSeconds(8));   // 8-sec timeout (preserve from source)
```

Admin/Processor/Manager/SuperAdmin (`requests.viewAll`) **bypass** the creator/requestor/assignee narrowing and see everything in the company.

#### 6.1.2 `POST /api/requests` — body and behavior

Body the frontend sends (accept any of these aliases — the source server normalizes them):

```json
{
  "REQUEST_NAME":        "Background check for John Doe",
  "REQUEST_DESCRIPTION": "Priority intake",
  "ABBREVIATION":        "BGCJD",
  "templateId":          42,
  "FORM_ID":             42,
  "ASSIGNED_ID":         null,
  "PRIORITY_LEVEL":      "Standard",
  "formFieldValues":     { "101": "John", "102": "1990-01-01" }
}
```

Server behavior:
1. Validate `REQUEST_NAME` non-empty.
2. Validate `PRIORITY_LEVEL ∈ {'Low','Standard','High'}`. Default `'Standard'`.
3. If `FORM_ID` provided and caller is External User, call `IFormAccessService.CanViewFormAsync` (see FormBuilderInstall.md §6.6) and reject 403 if not allowed.
4. **Force `STATUS = 'P'`** server-side. Do not trust client.
5. Default `ABBREVIATION` to first 5 uppercase letters of `REQUEST_NAME` if missing.
6. Auto-set `WORKSPACE_ID` from caller's active workspace if applicable.
7. Begin transaction.
8. Insert `REQUESTS`. Reload entity to pick up `TRACKINGID`.
9. If `templateId` + non-empty `formFieldValues`: insert one `FORMS_INSTANCE` for this request (`REQUEST_ID`, `FORM_ID`, `ASSIGNED_ID = caller userId`, `COMPANY_ID`) and one `FORMS_INSTANCE_VALUES` per non-empty value. (See FormBuilderInstall.md §6.5 — this is the same insert path as `POST /api/requests/{id}/form/submit`.)
10. Insert a system milestone via `IMilestoneService.RequestCreatedAsync(request)`. See §8.
11. Commit. Return 201.

Response:
```json
{
  "success": true,
  "message": "Request created successfully",
  "data": {
    "REQUEST_ID": 123,
    "REQUEST_NAME": "Background check for John Doe",
    "REQUEST_DESCRIPTION": "Priority intake",
    "ABBREVIATION": "BGCJD",
    "STATUS": "P",
    "SUBMITTED_DATE": "2026-05-17T12:34:56Z",
    "REQUESTOR_ID": 42,
    "ASSIGNED_ID": null,
    "TRACKINGID": "REQ-123",
    "COMPANY_ID": 54,
    "FORM_ID": 42,
    "PRIORITY_LEVEL": "Standard",
    "CREATE_DATE": "...",
    "UPDATE_DATE": "..."
  }
}
```

#### 6.1.3 `PUT /api/requests/{id}/assign`

Body: `{ "assignedUserId": 7 }` (null = unassign).

1. Verify assignee exists in caller's company (or null).
2. `UPDATE REQUESTS SET ASSIGNED_ID = @x, UPDATE_DATE = GETDATE(), UPDATE_USER_ID = @user WHERE REQUEST_ID = @id AND COMPANY_ID = @company`.
3. If assignee is non-null and != caller:
   - Insert `NOTIFICATIONS` row (`TYPE='assignment'`, `TITLE='New Request Assigned'`, `MESSAGE` includes name + tracking).
   - Fire email `EmailService.SendAssignmentAsync(...)` (don't await — fire-and-forget; log failures).
   - Insert `WORK_PROGRESS` row (`PROGRESS_TYPE='system'`, `Title='Request Assigned'`, `IsSystemGenerated=true`, `EventData = JSON({assignedUserId, assignedUserName, assignedBy})`).
4. Return `{ success: true, message: 'Request assigned successfully', requestId, assignedUserId }`.

#### 6.1.4 `POST /api/requests/{id}/start`

```sql
UPDATE GUARDIAN.REQUESTS
SET STATUS = 'A',
    UPDATE_DATE = GETDATE(),
    UPDATE_USER_ID = @userId,
    ASSIGNED_ID = COALESCE(ASSIGNED_ID, @userId)
WHERE REQUEST_ID = @id
  AND COMPANY_ID = @companyId
  AND (ASSIGNED_ID IS NULL OR ASSIGNED_ID = @userId)
```

If `RowsAffected == 0`, return `409` with body `{ "error": "NOT_ASSIGNEE", "message": "Request is assigned to another user" }`. Then insert a status-change milestone (`STATUS_FROM='P'`, `STATUS_TO='A'`).

#### 6.1.5 `POST /api/requests/{id}/complete`

Identical to `/start` but `STATUS = 'D'` and assignee check `ASSIGNED_ID = @userId OR ASSIGNED_ID IS NULL`. Body may carry `{ completionNotes: "..." }` — current source accepts it but does not persist it; for the .NET port, write it into `RESULTS_DESCRIPTION` in the same UPDATE if you want to fix the latent bug.

#### 6.1.6 `POST /api/requests/{id}/cancel`

Body: `{ "cancellationReason": "duplicate request" }` (≤500 chars).

```sql
UPDATE GUARDIAN.REQUESTS
SET STATUS = 'X',
    UPDATE_DATE = GETDATE(),
    UPDATE_USER_ID = @userId,
    CANCELLATION_REASON = @reason,
    CANCELLED_DATE = GETDATE(),
    CANCELLED_BY = @userId
WHERE REQUEST_ID = @id
  AND COMPANY_ID = @companyId
  AND (ASSIGNED_ID = @userId OR REQUESTOR_ID = @userId)
```

After commit, notify the *other* party (whichever of requestor/assignee did not perform the cancel). Insert status-change milestone.

### 6.2 Tasks

| # | Method | Path | Policy | Purpose |
|---|---|---|---|---|
| 11 | GET | `/api/requests/{requestId}/tasks` | RequestsCreate | Tasks for a request + summary counts |
| 12 | POST | `/api/tasks` | RequestsTasks | Create task (body has `requestId`) |
| 13 | PUT | `/api/tasks/{taskId}` | RequestsTasks | Update status / description / assignee |
| 14 | DELETE | `/api/tasks/{taskId}` | RequestsTasks | Delete (only `Pending` tasks) |

**Validation in `POST /api/tasks`:**

```json
{ "requestId": 123, "assignedUserId": 7, "description": "Verify SSN", "status": "Pending" }
```

- Reject if `description.length > 250`.
- Default `status = "Pending"`. Reject any other initial status.
- Verify `requestId` belongs to caller's company.
- If `assignedUserId` non-null, verify they're in the same company.
- On insert, write `ASSIGNED_USER_ID = @x` even if null (see Pitfall #2 — schema constraint must be relaxed in your migration).
- After insert, reload to get `TRACKINGID`. Fire notification + email if assignee != creator. Insert task-creation milestone (`PROGRESS_TYPE='task'`, `RELATED_TASK_ID=taskId`).

**Validation in `PUT /api/tasks/{taskId}`:**

```json
{ "assignedUserId": 9, "description": "...", "status": "In Progress" }
```

- Look up current task (must be in caller's company via JOIN to REQUESTS).
- Validate transition per §3.5.
- If assignee changes, fire notification + email + write reassignment milestone.
- If status changes, write a status-change milestone with `STATUS_FROM` / `STATUS_TO`.

### 6.3 Work progress (milestones, notes, files)

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 15 | GET | `/api/requests/{id}/progress` | Auth | Timeline of milestones, notes, status changes |
| 16 | POST | `/api/requests/{id}/progress` | Auth, multipart | Add a note/milestone, optionally with file |
| 17 | POST | `/api/requests/{id}/attachments` | Auth, multipart | Upload a standalone attachment |
| 18 | GET | `/api/requests/{id}/attachments` | Auth | List attachments + uploader info |
| 19 | GET | `/api/requests/{id}/attachments/{attachmentId}/download` | Auth | Stream the file |
| 20 | DELETE | `/api/requests/{requestId}/field-value/{fieldId}` | Auth | Delete one form-instance value — **belongs to form-builder feature; documented here for completeness** |

`POST /api/requests/{id}/progress` body (multipart):

```
progressType: 'note' | 'milestone' | 'status' | 'task' | 'document' | 'form' | 'system'   (default 'note')
title: string (required)
description: string?
hoursWorked: number?
statusUpdate: string?
isMilestone: boolean (default false)
isVisibleToRequestor: boolean (default true)
attachment: File?    (multer.single('attachment'))
```

On file upload: insert `ATTACHMENTS` first (with `REQUEST_ID = id`, `FILE_NAME`, `ATTACHMENT = bytes`, `COMPANY_ID`, `CREATE_USER_ID`). Then insert `WORK_PROGRESS` with `RELATED_ATTACHMENT_ID = attachmentId`.

Response:
```json
{ "success": true, "message": "Progress added", "workProgressId": 99, "attachmentId": 22 }
```

`GET /api/requests/{id}/progress` response (preserve casing):

```json
{
  "success": true,
  "progress": [
    {
      "workProgressId": 99,
      "requestId": 123,
      "userId": 42,
      "companyId": 54,
      "progressType": "milestone",
      "title": "Started review",
      "description": null,
      "hoursWorked": null,
      "statusUpdate": "In Progress",
      "relatedAttachmentId": null,
      "isMilestone": true,
      "isVisibleToRequestor": true,
      "createDate": "2026-05-17T13:00:00Z",
      "updateDate": "2026-05-17T13:00:00Z",
      "user": { "firstName": "Bob", "lastName": "Admin", "email": "bob@x.com" },
      "attachmentFileName": null
    }
  ]
}
```

Note: this endpoint uses **camelCase** keys (inconsistent with the rest of the API — preserve it). Use `[JsonPropertyName("progressType")]` on the DTO.

`POST /api/requests/{id}/attachments` (multipart, single field `file`) returns:

```json
{ "success": true, "message": "File uploaded successfully", "attachmentId": 22, "fileName": "form.pdf" }
```

Allowed extensions and 10 MB cap — match Notices/Form attachments policy (`pdf, jpg, jpeg, png, gif, doc, docx, xls, xlsx, txt, csv`).

---

## 7. DTO contracts (preserve casing exactly)

The frontend reads `REQUEST_ID`, `ASSIGNED_ID`, `TRACKINGID`, etc. literally. Use `[JsonPropertyName(...)]` on every record:

```csharp
public record RequestDto(
    [property: JsonPropertyName("REQUEST_ID")] int RequestId,
    [property: JsonPropertyName("REQUEST_NAME")] string RequestName,
    [property: JsonPropertyName("REQUEST_DESCRIPTION")] string? RequestDescription,
    [property: JsonPropertyName("ABBREVIATION")] string? Abbreviation,
    [property: JsonPropertyName("STATUS")] string Status,
    [property: JsonPropertyName("SUBMITTED_DATE")] DateTime SubmittedDate,
    [property: JsonPropertyName("REQUESTOR_ID")] int? RequestorId,
    [property: JsonPropertyName("ASSIGNED_ID")] int? AssignedId,
    [property: JsonPropertyName("TRACKINGID")] string? TrackingId,
    [property: JsonPropertyName("COMPANY_ID")] decimal? CompanyId,
    [property: JsonPropertyName("FORM_ID")] int? FormId,
    [property: JsonPropertyName("PRIORITY_LEVEL")] string PriorityLevel,
    [property: JsonPropertyName("RESULTS_DESCRIPTION")] string? ResultsDescription,
    [property: JsonPropertyName("CANCELLATION_REASON")] string? CancellationReason,
    [property: JsonPropertyName("CANCELLED_DATE")] DateTime? CancelledDate,
    [property: JsonPropertyName("CANCELLED_BY")] int? CancelledBy,
    [property: JsonPropertyName("CREATE_DATE")] DateTime CreateDate,
    [property: JsonPropertyName("UPDATE_DATE")] DateTime? UpdateDate,
    [property: JsonPropertyName("requestor")] UserSummaryDto? Requestor,
    [property: JsonPropertyName("assigned")]  UserSummaryDto? Assigned,
    [property: JsonPropertyName("requestorName")] string RequestorName,
    [property: JsonPropertyName("assignedName")]  string? AssignedName);

public record UserSummaryDto(
    [property: JsonPropertyName("FIRST_NAME")] string FirstName,
    [property: JsonPropertyName("LAST_NAME")] string LastName,
    [property: JsonPropertyName("EMAIL")] string Email);

public record TaskDto(
    [property: JsonPropertyName("TASK_ID")] int TaskId,
    [property: JsonPropertyName("REQUEST_ID")] int RequestId,
    [property: JsonPropertyName("STATUS")] string Status,
    [property: JsonPropertyName("ASSIGNED_USER_ID")] int? AssignedUserId,
    [property: JsonPropertyName("DESCRIPTION")] string? Description,
    [property: JsonPropertyName("CREATE_DATE")] DateTime CreateDate,
    [property: JsonPropertyName("UPDATE_DATE")] DateTime UpdateDate,
    [property: JsonPropertyName("TRACKINGID")] string? TrackingId,
    [property: JsonPropertyName("assignedUser")] UserSummaryDto? AssignedUser,
    [property: JsonPropertyName("createdBy")] UserSummaryDto CreatedBy);

public record TaskListResponse(
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("data")] List<TaskDto> Data,
    [property: JsonPropertyName("summary")] TaskSummary Summary);

public record TaskSummary(int totalTasks, int pendingTasks, int inProgressTasks, int completedTasks);

public record CreateRequestDto
{
    [JsonPropertyName("REQUEST_NAME")] public string? RequestName { get; init; }
    [JsonPropertyName("REQUEST_DESCRIPTION")] public string? RequestDescription { get; init; }
    [JsonPropertyName("ABBREVIATION")] public string? Abbreviation { get; init; }
    [JsonPropertyName("templateId")] public int? TemplateId { get; init; }
    [JsonPropertyName("FORM_ID")] public int? FormId { get; init; }
    [JsonPropertyName("ASSIGNED_ID")] public int? AssignedId { get; init; }
    [JsonPropertyName("PRIORITY_LEVEL")] public string? PriorityLevel { get; init; }
    [JsonPropertyName("formFieldValues")] public Dictionary<string, string>? FormFieldValues { get; init; }

    // also accept camelCase aliases (the React modal sends both shapes historically)
    [JsonPropertyName("name")] public string? NameAlias { set => RequestName ??= value; get => null; }
    [JsonPropertyName("description")] public string? DescriptionAlias { set => RequestDescription ??= value; get => null; }
    [JsonPropertyName("assignedId")] public int? AssignedIdAlias { set => AssignedId ??= value; get => null; }
}
```

---

## 8. Milestone service (system-event writer)

Centralize milestone writes so every status change, assignment, file upload, and task event leaves a row in `WORK_PROGRESS`. Frontends use this timeline as the audit log.

```csharp
public interface IMilestoneService
{
    Task RequestCreatedAsync(Request r);
    Task RequestStatusChangedAsync(Request r, string from, string to, int userId);
    Task RequestAssignedAsync(Request r, int assigneeUserId, string assigneeName, int assignedByUserId);
    Task DocumentUploadedAsync(int requestId, int attachmentId, string fileName, int userId, int companyId);
    Task TaskCreatedAsync(TaskItem t, int companyId, int userId);
    Task TaskStatusChangedAsync(TaskItem t, string from, string to, int companyId, int userId);
}
```

Each method inserts one `WORK_PROGRESS` row with `IS_SYSTEM_GENERATED = true`, `IS_VISIBLE_TO_REQUESTOR = true`, populated `STATUS_FROM/STATUS_TO/EVENT_DATA` as appropriate.

---

## 9. Implementation order

Run these phases in order. Validate after each.

### Phase A — Schema & infrastructure
1. Add entities + EF configurations (§3.1-3.3, §3.6).
2. Migration `InitRequests` — add the four tables + check constraints + the two `TRACKINGID` computed columns (§4.1).
3. Register services + policies (§5).
4. Implement `IMilestoneService` (§8).

**Validate:** `dotnet ef database update` runs. Insert a row in `REQUESTS` via SSMS — `TRACKINGID` populates to `REQ-{id}` automatically.

### Phase B — Read endpoints
5. `GET /api/requests/{id}` (joined with users).
6. `GET /api/requests` (with row-visibility filter §6.1.1).
7. `GET /api/requests/assigned/me`.

**Validate:** Hit each with a JWT for a non-admin user; confirm only requests where the user is creator/requestor/assignee return.

### Phase C — Request lifecycle
8. `POST /api/requests` (transactional, with optional `FORMS_INSTANCE` insert).
9. `POST /api/requests/{id}/start` / `/complete` / `/cancel`.
10. `PUT /api/requests/{id}/description`.
11. `DELETE /api/requests/{id}`.

**Validate:** Create → start → add progress → complete a request from Postman. `WORK_PROGRESS` has 3+ rows (create, start, complete). `TRACKINGID` populates without app intervention.

### Phase D — Assignment + notifications
12. `PUT /api/requests/{id}/assign`.
13. Wire `INotificationService.CreateAsync(...)` + `IEmailService.SendAssignmentAsync(...)` from the assignment path.

**Validate:** Assign a request — a row appears in `NOTIFICATIONS` for the assignee, an email is sent, a milestone is logged. Email failure does NOT roll back the assignment.

### Phase E — Tasks
14. `GET /api/requests/{requestId}/tasks`, `POST /api/tasks`, `PUT /api/tasks/{taskId}`, `DELETE /api/tasks/{taskId}`.
15. Status-transition validator (§3.5).
16. Task-assignment notification + email.

**Validate:** Open the Tasks tab of an existing request in the React UI; create, assign, complete a task end-to-end.

### Phase F — Work progress & attachments
17. `GET /api/requests/{id}/progress`, `POST /api/requests/{id}/progress` (multipart).
18. `POST /api/requests/{id}/attachments`, `GET /api/requests/{id}/attachments`, attachment download.

**Validate:** Upload a PDF on the progress tab; row appears in `ATTACHMENTS`, a milestone in `WORK_PROGRESS`, and the file downloads correctly.

---

## 10. React frontend — what to change

**Do NOT change:**

- `src/pages/RequestDashboard.tsx`
- `src/pages/NewRequest.tsx`, `src/pages/NewRequestModal.tsx`
- `src/components/RequestModal.tsx`, `AddRequestModal.tsx`
- `src/components/TaskTable.tsx`, `AddTaskModal.tsx`, `AssignTaskModal.tsx`
- `src/services/requestService.ts`

**Do change:**

1. `vite.config.ts` proxy — point `/api` at the .NET host (same change as the form builder port; if you already updated it, nothing to do).
2. JWT claims — the .NET issuer must put `userId`, `companyId`, `roles[]` in the token (same as FormBuilderInstall.md §4).

---

## 11. Pitfalls — read before coding

1. **`COMPANY_ID` is `DECIMAL(38,0)`** on `REQUESTS` (not `INT`). Use `decimal?` in C#. If you compare it against another `int` companyId from claims, cast: `r.CompanyId == (decimal)companyId`. This is the single most common source of subtle filter bugs.

2. **`TASKS.ASSIGNED_USER_ID` is `NOT NULL` in the schema, but the source code routinely passes `NULL`.** Two ways to fix in the target DB:
   - **Recommended**: alter the column to `NULL` in a migration. The frontend already handles unassigned tasks.
   - Alternative: use a sentinel user id (e.g. `0`) — requires frontend changes you don't want.
   The .NET model uses `int?`. Make sure your migration matches.

3. **`TRACKINGID` is a computed column.** If you let EF Core try to write it, you get SQL Server error 271 ("computed column cannot be modified"). The `SetAfterSaveBehavior(PropertySaveBehavior.Ignore)` line in §3.1/3.2 is mandatory.

4. **`REQUESTS.STATUS` Prisma default is `'A'`, but request creation must use `'P'`.** Always set `Status = "P"` explicitly on insert; don't rely on the DB default. (The Node source has a code/schema mismatch here — don't propagate it.)

5. **`CHK_REQUESTS_CANCELLATION_FIELDS` is strict.** You cannot set `STATUS = 'X'` without populating `CANCELLED_DATE` and `CANCELLED_BY` in the same UPDATE — and you cannot have those columns populated unless `STATUS = 'X'`. So if you ever need to "uncancel" a request (you shouldn't), you must NULL all three at once.

6. **Email must be fire-and-forget.** A bounced or timed-out email cannot fail the API call. Wrap email send in a try/catch and log; never let it bubble past the controller.

7. **`/start` and `/complete` are no-ops if `RowsAffected == 0`.** That happens when someone else owns the assignment. Source code historically returned `200 OK` silently — commit `6164650` ("stop silent no-op on request start/complete") fixed it. In your port, always check `RowsAffected` and return `409` with a meaningful error.

8. **8-second query timeout** on `GET /api/requests` (`server.cjs:2461`). Apply `context.Database.SetCommandTimeout(8)` or use `CancellationToken` so the endpoint fails fast under load.

9. **`completionNotes` body field is currently ignored.** The source accepts it on `POST /api/requests/{id}/complete` but never persists it. For the .NET port, write it into `RESULTS_DESCRIPTION` to fix the bug.

10. **Workspace scoping is optional but enforced when present.** If the user has an active workspace (`ACTIVE_WORKSPACE_ID` on USERS), `GET /api/requests` must filter `r.WorkspaceId == workspaceId OR r.WorkspaceId IS NULL`. Don't skip — the frontend depends on workspace-scoped lists.

11. **`Notifications` table uses different casing than other JSON responses.** `GET /api/requests/{id}/progress` returns `camelCase` keys but `GET /api/requests` returns `ALL_CAPS_SNAKE_CASE`. Stick with the source convention per endpoint — don't try to unify.

12. **`REQUEST_ID` on `ATTACHMENTS` is reused as a polymorphic FK** — same table is used for notice response attachments. Don't add a hard FK constraint that would break the notice path.

13. **`FORMS_INSTANCE.REQUEST_ID` is not a hard FK** in the source schema (see FormBuilderInstall.md §6.5). Same applies here.

14. **Concurrent start/assignment**: two managers double-clicking "Assign" can race. Add `[ConcurrencyCheck]` on `Request.UpdateDate` or use SQL `WHERE ... AND UPDATE_DATE = @originalUpdateDate` to detect lost updates. This was not handled in the source; do better.

---

## 12. Smoke test (manual, ~15 min)

After Phase F:

1. **Login** as a Manager (role 4) on the React frontend pointed at the .NET API.
2. **Create request** via NewRequestModal with a form template — confirm `REQUESTS` row with `STATUS='P'`, `TRACKINGID='REQ-{id}'`, `FORMS_INSTANCE` + `FORMS_INSTANCE_VALUES` rows present.
3. **Assign** the request to another user via the Assign modal — confirm:
   - `NOTIFICATIONS` row exists for the assignee.
   - Email sent (check provider dashboard / log).
   - `WORK_PROGRESS` has a system "Request Assigned" row.
4. **Start** the request as the assignee — `STATUS → 'A'`, milestone row added with `STATUS_FROM='P', STATUS_TO='A'`.
5. **Add task** in the Tasks tab, assign to a third user, set status to In Progress, then Completed — confirm:
   - 1 `TASKS` row, `TRACKINGID='TSK-{id}'`, two status-change milestones in `WORK_PROGRESS`.
   - Notifications + emails to the task assignee.
6. **Upload attachment** under the Progress tab — `ATTACHMENTS` row exists, file downloads via the download URL.
7. **Complete** the request — `STATUS='D'`, milestone row.
8. **Try to cancel** the completed request — `409` (terminal state).
9. **As a regular User (role 2)** log in and visit Requests — confirm you only see requests you created/requested/are assigned to.
10. **As Admin (role 1)** visit Requests — confirm the full company list returns.

If all 10 steps pass, the install is complete.

---

## 13. Reference — source files in the Guardian MVP repo

| Concern | File:line |
|---|---|
| Prisma schema (truth) | `prisma/schema.prisma` lines 320-355 (REQUESTS), 371-384 (TASKS), 14-29 (ATTACHMENTS), 30-79 (WORK_PROGRESS), 454+ (NOTIFICATIONS) |
| `POST /api/requests` | `server.cjs` lines 2101-2401 |
| `GET /api/requests` (visibility filter) | `server.cjs` lines 2404-2537 |
| `GET /api/requests/:id` | `server.cjs` lines 2540-2650 |
| `PUT /api/requests/:id/assign` | `server.cjs` lines 4108-4281 |
| `POST /api/requests/:id/start` | `server.cjs` lines 1867-1916 |
| `POST /api/requests/:id/complete` | `server.cjs` lines 1919-1975 |
| `POST /api/requests/:id/cancel` | `server.cjs` lines 1978-2100 |
| `GET /api/requests/assigned/me` | `server.cjs` lines 1788-1866 |
| `GET /api/requests/:id/progress` | `server.cjs` lines 4430-4517 |
| `POST /api/requests/:id/progress` | `server.cjs` lines 4520-5143 |
| `GET /api/requests/:requestId/tasks` | `server.cjs` lines 5787-5872 |
| `POST /api/tasks` | `server.cjs` lines 5875-6073 |
| `PUT /api/tasks/:taskId` | `server.cjs` lines 6076-6317 |
| `DELETE /api/tasks/:taskId` | `server.cjs` lines 6319-6381 |
| `POST /api/requests/:id/attachments` | `server.cjs` lines 6383-6467 |
| `GET /api/requests/:id/attachments` | `server.cjs` lines 6470-6540 |
| Permissions matrix | `lib/permissions.cjs` (role × permission grid) |
| Migrations | `migrations/add_priority_level_to_requests.sql`, `migrations/add_request_cancellation_fields.sql` |
| React dashboard | `src/pages/RequestDashboard.tsx` |
| React detail modal | `src/components/RequestModal.tsx` |
| React task table | `src/components/TaskTable.tsx` |
| React services | `src/services/requestService.ts`, `src/services/taskService.ts` |

---

## 14. Out of scope (do not implement)

- **Real-time updates** (SignalR / WebSockets) — current UI polls. Add later if needed.
- **Bulk task operations** beyond what `TaskTable.tsx` already does client-side.
- **External User onboarding** — handled by the Invites feature; out of scope here.
- **Site analytics drill-downs** that aggregate across requests — separate "Site Analysis" feature.
- **WORK_PROGRESS edit/delete** — milestones are append-only by design. Don't add update endpoints.
- **Soft-delete on Requests** — the source uses hard `DELETE` (with a status guard). Don't introduce a new soft-delete column without product sign-off.

When the user asks for any of these, push back and ask whether they're really needed.
