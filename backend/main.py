from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow frontend + extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

latest_data = {
    "typingMood": "Neutral",
    "faceMood": "Neutral",
}


@app.get("/")
def home() -> dict[str, str]:
    return {"message": "API running"}


# Receive typing emotion (from extension)
@app.post("/typing")
def receive_typing(data: dict) -> dict[str, str]:
    latest_data["typingMood"] = data.get("mood", "Neutral")
    return {"status": "ok"}


# Receive face emotion (from frontend webcam)
@app.post("/face")
def receive_face(data: dict) -> dict[str, str]:
    latest_data["faceMood"] = data.get("emotion", "Neutral")
    return {"status": "ok"}


# Send combined data to frontend
@app.get("/emotion")
def get_emotion() -> dict[str, str]:
    return latest_data
