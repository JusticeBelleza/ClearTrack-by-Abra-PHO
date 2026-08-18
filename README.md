# 📂 ClearTrack Document Tracker

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC.svg?logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Powered-3ECF8E.svg?logo=supabase)

A modern, real-time document routing and tracking system built for the Provincial Health Office. ClearTrack eliminates lost paperwork by providing a strict digital trail, electronic signatures, and real-time accountability for every document moving through the organization.

---

## ✨ Key Features

* **Real-Time Routing:** Documents are tracked live. As soon as a document is routed to a new department, the receiving clerks get instant notifications via Supabase Realtime WebSockets.
* **Immutable Digital Trail:** Every action (creation, handover, rejection, completion) is securely logged with exact timestamps, locations, and the personnel involved.
* **E-Signatures & File Previews:** Built-in support for generating e-signatures during handovers and a native mobile-friendly PDF/Image previewer for scanned attachments.
* **Mobile-First UX:** Designed for on-the-go personnel. Features native-feeling bottom-sheet modals, touch-friendly routing interfaces, and searchable dropdowns.
* **Advanced Admin Portal:** Comprehensive dashboard for managing departments, document categories, and employee access. Includes secure Edge Functions for role-based access control and force-resetting user passwords.
* **Smart Dashboard:** Users have a clear, tabbed overview of their active routes, urgent/rush documents, and items requiring immediate action.

---

## 🛠️ Technology Stack

### Frontend
* **Core:** React (via Vite)
* **Styling:** Tailwind CSS
* **State & Data Fetching:** `@tanstack/react-query` for aggressive caching and fast UI updates
* **Icons & UI Elements:** `lucide-react`, `sonner` (for toast notifications)
* **Utilities:** `jspdf` (for image-to-PDF scanning conversion)

### Backend (Supabase)
* **Authentication:** Supabase Auth (Email/Password)
* **Database:** PostgreSQL with Row Level Security (RLS) policies
* **Storage:** Supabase Storage (for PDF attachments and signature PNGs)
* **Serverless:** Deno Edge Functions (for secure, elevated administrative tasks)
* **Realtime:** Postgres Changes subscriptions for instant dashboard updates

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine. You will also need a Supabase project set up.

### Installation

1. **Install dependencies**
   Ensure you are in the project directory, then run:
   ```bash
   npm install

2. **Environment Setup**
   Create a .env.local file in the root directory and add your Supabase credentials:
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

3. **Run the development server**
   npm run dev

### Supabase Edge Functions Deployment
If you are modifying the administrative backend functions (like creating employees or resetting passwords), you need the Supabase CLI installed.

\`\`\`bash
supabase functions deploy create-employee
supabase functions deploy reset-password
\`\`\`

---

## 📱 Interface Highlights

| Feature | Description |
| :--- | :--- |
| **Searchable Comboboxes** | Custom-built, accessible dropdowns that handle hundreds of employees without lagging, featuring sticky search headers. |
| **Priority Flags** | Documents can be flagged as "RUSH", visually alerting all receiving departments with pulsing red indicators. |
| **Certificate generation** | E-signatures are displayed as professional, verified certificates within the digital trail. |

---

## 👨‍💻 Developer Information

**Designed & Developed by:**  
**Justice P. Belleza**  
*ICT Officer Designate, Provincial Health Office*

Built to streamline bureaucratic routing, ensure accountability, and modernize public health office operations.