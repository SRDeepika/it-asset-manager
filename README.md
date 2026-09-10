# IT Asset Management System — Harvest Group of Schools

A web-based IT asset tracking tool designed to manage hardware assets across their operational lifecycle, eliminate spreadsheet errors, and maintain a complete historical audit trail.

---

## 🚀 Quick Start Guide

### Prerequisites
* Node.js (v14.x or higher)
* npm (v6.x or higher)

### Setup & Installation

1. **Clone Repository:**
   ```bash
   git clone [https://github.com/SRDeepika/it-asset-manager.git](https://github.com/SRDeepika/it-asset-manager.git)
   cd it-asset-manager
Install Dependencies:

Bash
npm install
Database Setup:
The SQLite database (assets.db) initializes and seeds core tables automatically when the server starts.

Start Application:

Bash
node app.js
Access Application:
Navigate to http://localhost:3000

Username: admin

Password: password123

🛠️ Data Model & Re-Assignment Strategy
Schema Overview
assets: Tracks hardware details (id, asset_tag [UNIQUE], serial_number [UNIQUE], name, type, status).

staff: Holds personnel records (id, name, email [UNIQUE], department).

assignments: Audit log linking assets to staff (id, asset_id, staff_id, assigned_at, returned_at).

Re-Assignment Strategy
Asset re-assignment uses an append-only assignment log strategy:

When assigned, a row is added to assignments with assigned_at = CURRENT_TIMESTAMP and returned_at = NULL.

When returned, returned_at is updated to CURRENT_TIMESTAMP, and asset status reverts to available.

When re-assigned to a new staff member, a new row is created in assignments, preserving historical records without overwriting past assignment history.

📋 Features Implemented
Asset Directory & Search: View, create, and edit assets. Filter simultaneously by Type and Status with filter state retention.

Exporting: Single-click CSV export (/assets/export) of active inventory records.

Assignment Lifecycle: Assign and return devices with validated drop-down selections.

Historical Audit Logs: Chronological logs of past checkouts per asset (/assets/history/:id).

Staff Directory: Track items currently assigned to specific staff members (/staff).
