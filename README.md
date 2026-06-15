# ExpenseLens - Shared Expense Intelligence Platform

ExpenseLens is a premium **Shared Expense Intelligence Platform** designed to solve complex multi-currency, membership timeline, and transaction auditing challenges. It is built as an internship assessment task to deliver transparent, explainable, and fully auditable shared ledgers.

---

## Technical Stack

- **Frontend**: React 19, TypeScript, TailwindCSS v4, React Router 6, Lucide Icons.
- **Backend**: Django 5, Django REST Framework, python-dotenv, dj-database-url, SQLite (local) / PostgreSQL (Neon production).
- **Database**: PostgreSQL (configurable via environment variables).

---

## Key Signature Features

1. **Explain My Balance**: Complete visual audit trace showing roommate consumption splits, USD currency conversions at historical rates, and timeline adjustments.
2. **Audit Center**: Relational queue tracking 9 distinct transaction anomalies (Duplicates, timeline conflicts, settlement patterns, negative amounts, split total mismatches, unknown members, and missing payers).
3. **Import Intelligence Dashboard**: Ingestion wizard parsing spreadsheets, calculating ingestion metrics (Accepted/Flagged/Rejected rows), and rendering a **Data Quality Health Score**.
4. **Decision Trail**: Immutable ledger of operator decisions, resolution actions (Merge, Convert, Ignore), operators, timestamps, and justifications.
5. **Membership Timelines**: Splitting engine honors roommate active date ranges (e.g. Meera leaving March 31, Sam joining April 15) to prevent accidental charges.

---

## Setup & Running Locally

### 1. Clone & Configuration
Configure the `.env` file in the project root:
```bash
# Template in .env.example
DEBUG=True
SECRET_KEY=django-insecure-your-secret-key-change-this-in-production
DATABASE_URL= # Leave empty to use default local sqlite3
```

### 2. Backend (Django)
Initialize virtual environment, install packages, compile migrations, and start the development server:
```bash
# Navigate to workspace root
python -m venv .venv
.venv\Scripts\activate

# Install requirements
.venv\Scripts\pip install -r requirements.txt

# Migrate and Run
.venv\Scripts\python backend/manage.py migrate
.venv\Scripts\python backend/manage.py runserver
```

The Django REST API will run on `http://localhost:8000`.

### 3. Frontend (React + Vite)
Install dependencies and launch the dev server:
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

*Note: If the Django server is offline, the React app will show a clear "Backend Not Connected" blocker screen.*

---

## Generating Import Reports (CLI Utility)

You can run the command-line utility in the backend directory to export generated ingestion reports:

```bash
# List all imported spreadsheet batches
.venv\Scripts\python backend/generate_import_report.py --list

# Render markdown report for a specific batch
.venv\Scripts\python backend/generate_import_report.py --batch-id <batch-uuid> --output reports/march_report.md
```

---

## Running Backend Tests

Run the Django automated verification suite:
```bash
.venv\Scripts\python backend/manage.py test
```
