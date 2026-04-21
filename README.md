# Driplytics

Driplytics is a full-stack sneaker analytics platform with:
- A React + Vite frontend
- A Node.js + Express backend
- A Flask-based ML service for sneaker price prediction

## Project Structure

- `client/` - Frontend (React, Vite)
- `server/` - Backend API (Express, MongoDB, Socket.IO)
- `ml_service/` - Machine learning API (Flask, scikit-learn, Prophet)

## Prerequisites

Install these first:
- Node.js 18+ (recommended 20+)
- Python 3.10+
- MongoDB (local or cloud MongoDB Atlas)
- Git

## 1) Clone and Open Project

```bash
git clone <your-repo-url>
cd Driplytics
```

## 2) Setup Backend (server)

```bash
cd server
npm install
```

Create `server/.env` with at least:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/driplytics
JWT_SECRET=replace_with_a_strong_secret
PORT=5000
ML_SERVICE_URL=http://localhost:5002
FRONTEND_URL=http://localhost:5173
```

Optional backend variables (for full feature support):

```env
# Email (OTP / password reset)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# SMS alerts
TEXTBELT_API_KEY=textbelt_or_your_real_key

# Khalti subscription payments
KHALTI_SECRET_KEY=your_khalti_secret_key
KHALTI_SANDBOX=true
KHALTI_API_URL=https://a.khalti.com/api/v2
```

## 3) Setup ML Service (ml_service)

From the project root:

```bash
cd ml_service
python -m venv .venv
```

Activate virtual environment:

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r ../requirements.txt
```

Create `ml_service/.env` (or copy from `ml_service/.env.example`):

```env
GROQ_API_KEY=your_groq_api_key_here
REDDIT_CLIENT_ID=optional_for_live_reddit_data
REDDIT_CLIENT_SECRET=optional_for_live_reddit_data
```

### Train models (first run only)

The ML API expects trained model files in `ml_service/models/`.

```bash
python train_model.py
```

## 4) Setup Frontend (client)

From the project root:

```bash
cd client
npm install
```

Create `client/.env` (or copy from `client/.env.example`) and use:

```env
VITE_API_URL=http://localhost:5000/api
```

Note: if your backend runs on a different port, update this URL accordingly.

## 5) Run the Project (3 terminals)

Run each service in its own terminal.

Terminal 1 - ML service:

```bash
cd ml_service
# activate venv first
python app.py
```

Terminal 2 - Backend:

```bash
cd server
npm run dev
```

Terminal 3 - Frontend:

```bash
cd client
npm run dev
```

Open the frontend URL shown by Vite (usually `http://localhost:5173`).

## Health Checks

- Backend health: `http://localhost:5000/`
- Backend test endpoint: `http://localhost:5000/api/test`
- ML health: `http://localhost:5002/health`

## Running Tests

Backend tests:

```bash
cd server
npm test
```

ML tests (if `pytest` is installed):

```bash
cd ml_service
pytest tests -v
```

## Common Issues

1. Backend says MONGODB_URI is not defined
- Add `MONGODB_URI` to `server/.env`.

2. Frontend cannot connect to backend
- Confirm backend is running on port 5000.
- Confirm `client/.env` has `VITE_API_URL=http://localhost:5000/api`.

3. Backend cannot reach ML service
- Confirm ML service is running on port 5002.
- Confirm `ML_SERVICE_URL=http://localhost:5002` in `server/.env`.

4. ML service says models are not loaded
- Run `python train_model.py` in `ml_service/`.

## Production Notes

- Replace all development secrets before deployment.
- Do not commit real `.env` files.
- Set `NODE_ENV=production` for backend deployment.
