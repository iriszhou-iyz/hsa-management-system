## Setup Instructions

### Get source code
git clone https://github.com/iriszhou-iyz/hsa-management-system.git

### Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

### Frontend
cd frontend
npm install
npm run dev

Interact at: http://localhost:5173/

