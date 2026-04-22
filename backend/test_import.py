import os
os.environ["GEMINI_API_KEY"] = "AIzaSyAPAYoRzZlz5LOu5h6cskkzVKiW9CUMmUk"
os.environ["GOOGLE_API_KEY"] = "AIzaSyAPAYoRzZlz5LOu5h6cskkzVKiW9CUMmUk"
from fastapi.testclient import TestClient
from main import app
from auth import create_token
client = TestClient(app)
token = create_token(1)

try:
    res = client.post("/api/profile/import-latex", headers={"Authorization": f"Bearer {token}"}, json={"latex":"Test"})
    print(res.status_code)
    print(res.text)
except Exception as e:
    import traceback
    with open("error.log", "w") as f:
        traceback.print_exc(file=f)
