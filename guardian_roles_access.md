# Guardian System — Roles & Access Matrix

## Role Definitions

| Role | Description |
|------|-------------|
| **Guardian Admin** | Configure group items; full oversight and management of all group workflows |
| **General User** | Submit and receive workflows within a group |
| **Processor** | Process workflows on behalf of others in a group |
| **Manager** | Oversee all workflows being processed within a group |
| **External User** | Limited guest access to submit/receive permitted workflows only |

---

## Access Matrix

> **Key:** `✓` Full access · `–` No access · `◑` Restricted (limited types only)

### Landing Page (Home)

| Feature | Admin | General User | Processor | Manager | External User |
|---------|:-----:|:------------:|:---------:|:-------:|:-------------:|
| Request Queue | ✓ | – | ✓ | ✓ | – |
| Request Overview | ✓ | – | ✓ | ✓ | – |
| My Requests | ✓ | ✓ | ✓ | ✓ | ✓ |
| Notices | ✓ | ✓ | ✓ | ✓ | ✓ |

### Requests Page

| Feature | Admin | General User | Processor | Manager | External User |
|---------|:-----:|:------------:|:---------:|:-------:|:-------------:|
| New Requests | ✓ | ✓ | ✓ | ✓ | ◑ |
| View All Group Requests | ✓ | – | ✓ | ✓ | – |
| View All Group Request Details | ✓ | – | ✓ | ✓ | – |
| View My Requests / Details | ✓ | ✓ | ✓ | ✓ | ✓ |
| Start Requests | ✓ | – | ✓ | ✓ | – |
| Assign Requests | ✓ | – | – | ✓ | – |
| Reassign Request | ✓ | – | – | ✓ | – |
| Create, Assign, Start, Complete Tasks | ✓ | – | ✓ | ✓ | – |
| Add Results / Complete Requests | ✓ | – | ✓ | ✓ | – |

### Notices Page

| Feature | Admin | General User | Processor | Manager | External User |
|---------|:-----:|:------------:|:---------:|:-------:|:-------------:|
| New Notice | ✓ | – | ✓ | ✓ | – |
| View All Group Notices & Details | ✓ | – | ✓ | ✓ | – |
| View My Notices / Details | ✓ | ✓ | ✓ | ✓ | ◑ |
| Respond to Notices | ✓ | ✓ | ✓ | ✓ | ✓ |

### Reporting

| Feature | Admin | General User | Processor | Manager | External User |
|---------|:-----:|:------------:|:---------:|:-------:|:-------------:|
| Workflow Reporting *(TBD)* | ✓ | – | – | ✓ | – |

---

## Restricted Access Notes

- **External User — New Requests:** Only request types explicitly permitted for external users are available.
- **External User — View My Notices / Details:** Only notices explicitly permitted for external users are visible.

---

## Role Summary by Permission Scope

| Scope | Roles |
|-------|-------|
| Full group visibility (all requests, notices) | Admin, Processor, Manager |
| Task & request processing | Admin, Processor, Manager |
| Assign / Reassign requests | Admin, Manager |
| Workflow reporting | Admin, Manager |
| Self-service only (own requests/notices) | General User, External User |
| Guest / restricted access | External User |
