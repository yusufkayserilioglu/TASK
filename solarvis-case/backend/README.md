**Backend** (terminal 1):

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows  |  macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```