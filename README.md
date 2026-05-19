# Health Savings Account Platform

A full-stack HSA account simulation platform that lets users create accounts, deposit funds, issue virtual debit cards, and simulate qualified or declined medical transactions.

## Features

- Create HSA accounts with username and email
- Deposit funds
- Issue virtual debit cards
- Simulate purchases
- Approve qualified medical expenses
- Decline invalid or overdrafted transactions
- View transaction history

## Setup Instructions

### Get source code

```bash
git clone https://github.com/iriszhou-iyz/hsa-management-system.git
cd hsa-management-system
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend API:

```text
http://127.0.0.1:8000
```

API endpoints:

```text
http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Interact with the app at:

```text
http://localhost:5173/
```

