# FileTrackr: System Review and Database Architecture

## 1. System Evaluation

### Is it "Enterprise Grade"?
**Yes, it strongly leans toward enterprise-grade.** The system checks off the critical boxes required for serious organizational use, especially for a government or health office:
* **Robust Security:** Utilizes Supabase's Row Level Security (RLS) policies to ensure users can only access documents they are authorized to see. It also implements Role-Based Access Control (RBAC) separating `admin` and `pho_staff`.
* **Auditability:** Enterprise systems require strict logging. The `document_logs` table and the `DigitalTrailModal` provide a non-repudiable audit trail of who touched a document and when. 
* **Real-time Synchronization:** Using Supabase Websockets for instant UI updates prevents data collisions when multiple clerks are handling documents simultaneously.
* **Type Safety & Reliability:** Built with TypeScript, which drastically reduces runtime bugs, alongside a `GlobalErrorBoundary` to catch UI crashes gracefully.
* **Progressive Web App (PWA):** Includes PWA configurations, allowing staff to install this directly on their devices like a native app.

**What it lacks for *strict* enterprise classification:** True enterprise systems usually have comprehensive telemetry/monitoring (like Sentry or Datadog) to track frontend errors, and extensive automated test suites. The inclusion of End-to-End testing (`e2e/routing.spec.ts` using Playwright) is an excellent start.

### Is it Sustainable?
**Highly sustainable.**
* **Modern Tech Stack:** Built using React, Vite, Tailwind CSS, TypeScript, and Supabase. This is a highly popular and well-documented stack, ensuring ease of maintenance and hand-over.
* **No Server Maintenance:** By using a Backend-as-a-Service (Supabase) and a static host for the Vite frontend, there is no need to patch Linux servers or manage Docker containers manually.
* **Open-Source Core:** While relying heavily on Supabase, the core of Supabase is open-source. If the cloud service changes, the system can technically be self-hosted.

### Strategic Recommendations
* **Automated Backups (Crucial):** Ensure the Supabase project is on a plan that includes automated daily backups (Point-in-Time Recovery), or set up a cron job to periodically dump the database.
* **Data Retention & Archival Strategy:** Consider writing a Supabase Edge Function to move `sealed` and `cancelled` documents older than 5 years into a cheaper "cold storage" archive to maintain database performance.
* **Frontend Error Tracking:** Integrate a tool like **Sentry**. If a user experiences a crash, it will instantly report the exact line of code that failed.
* **Offline Fallback:** Implement offline caching (e.g., via React Query plugins) so the app does not immediately crash if the local office network drops.

---

## 2. Database Schema & Architecture

### 🗺️ Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    PROFILES ||--o{ DOCUMENTS : "creates"
    PROFILES ||--o{ DOCUMENT_LOGS : "performs"
    DOCUMENTS ||--o{ DOCUMENT_LOGS : "tracks"
    DEPARTMENTS ||--o{ EMPLOYEES : "contains"

    PROFILES {
        uuid id PK "References auth.users"
        text full_name
        text role "admin, pho_staff"
        timestamp created_at
    }

    DOCUMENTS {
        uuid id PK
        text reference_no UK
        text title
        text subject
        text category
        text status "pending, routing, sealed, cancelled"
        text assigned_clerk
        uuid created_by FK "References profiles.id"
        uuid custodian_id
        text final_destination
        text current_location
        text remarks
        text attachment_url
        boolean is_urgent
        timestamp created_at
        timestamp updated_at
    }

    DOCUMENT_LOGS {
        uuid id PK
        uuid document_id FK "References documents.id"
        uuid performed_by FK "References profiles.id"
        text action "Created, Re-assigned, Delivered, Cancelled"
        text remarks
        timestamp created_at
    }

    DEPARTMENTS {
        uuid id PK
        text name UK
        timestamp created_at
    }

    EMPLOYEES {
        uuid id PK
        text name
        text department FK "References departments.name"
        timestamp created_at
    }

    GLOBAL_SETTINGS {
        int id PK
        boolean maintenance_mode
        timestamp updated_at
    }

### 🗄️ Table Definitions

#### `profiles`
Stores extended user information linked to the Supabase `auth.users` table.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, FK to `auth.users.id` | Unique identifier. |
| `full_name` | `text` | Not Null | Employee's full display name. |
| `role` | `text` | Default: `pho_staff` | Determines access level (`admin` or `pho_staff`). |
| `created_at` | `timestamp` | Default: `now()` | Record creation time. |

#### `documents`
The core table tracking all active and archived routing documents.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Unique document identifier. |
| `reference_no` | `text` | Unique | Human-readable tracking number. |
| `title` | `text` | Not Null | Document title. |
| `subject` | `text` | | Expanded document subject/description. |
| `category` | `text` | | e.g., Memorandum, Voucher, Leave Request. |
| `status` | `text` | Default: `pending` | `pending`, `routing`, `sealed`, `cancelled`. |
| `assigned_clerk` | `text` | | Staff currently managing the document. |
| `created_by` | `uuid` | FK to `profiles.id` | Original creator of the routing slip. |
| `final_destination`| `text` | | Target department/office. |
| `current_location` | `text` | | Current physical location of the document. |
| `remarks` | `text` | | Return reasons or cancellation notes. |
| `attachment_url` | `text` | | Supabase Storage path for digital copies. |
| `is_urgent` | `boolean`| Default: `false` | Flags document for rush processing. |
| `created_at` | `timestamp` | Default: `now()` | Initial creation. |
| `updated_at` | `timestamp` | Default: `now()` | Last modification time. |

#### `document_logs`
Immutable audit trail ensuring accountability for every document action.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | Unique log identifier. |
| `document_id` | `uuid` | FK to `documents.id` | The document this log belongs to. |
| `performed_by` | `uuid` | FK to `profiles.id` | The user who triggered the action. |
| `action` | `text` | Not Null | Standardized action. |
| `remarks` | `text` | | Context regarding the specific action. |
| `created_at` | `timestamp` | Default: `now()` | Exact timestamp of the event. |

#### Lookup & System Tables
* **`departments`**: `id`, `name`, `created_at`
* **`employees`**: `id`, `name`, `department`, `created_at`
* **`global_settings`**: `id` (Always `1`), `maintenance_mode` (`boolean`)

---

### 🔒 Row Level Security (RLS) Policies

The database enforces strict zero-trust security at the Postgres level. Users can only fetch or manipulate data they are authorized to see based on their authenticated JWT token.

#### Document Access Rules
* **Admins:** Can `SELECT`, `INSERT`, `UPDATE`, and `DELETE` all documents.
* **PHO Staff (Read):** Can `SELECT` any document not marked as confidential, enabling transparent organization-wide tracking.
* **PHO Staff (Write):** Can only `UPDATE` a document if their `profiles.full_name` matches the document's `assigned_clerk` OR if their `auth.uid()` matches `created_by`.

#### Document Logs Rules
* **Immutability:** `document_logs` are strictly `INSERT` and `SELECT` only.
* **No Deletion:** No user, including `admin`, is granted `DELETE` or `UPDATE` privileges on the `document_logs` table through the API to preserve audit integrity.

#### Storage Bucket Rules (Attachments)
* **Uploads:** Authenticated users can upload files to the `attachments` bucket.
* **Downloads:** Only authenticated users can retrieve signed URLs for file previews.