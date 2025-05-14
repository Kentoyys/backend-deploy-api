from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.spelling_test import router as spelling_router
from routers.handwritten_test import router as handwritten_router
from routers.phonospeech_test import router as phonospeech_router
from routers.letterconfusion import router as letterconfusion_router
from routers.numberunderstanding import router as numberunderstanding_router
from routers.arithmetic_test import router as arithmetic_router
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# Serve static files for audio
app.mount("/audio", StaticFiles(directory=os.path.join(os.getcwd(), "audio/correct")), name="audio")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spelling_router, prefix="/spelling_test", tags=["Dyslexia Spelling"])
app.include_router(handwritten_router, prefix="/handwritten_test", tags=["Dysgraphia Handwriting"])
app.include_router(phonospeech_router, prefix="/phonospeech_test", tags=["Dyslexia Speech"])
app.include_router(letterconfusion_router, prefix="/letterconfusion_test", tags=["Dyslexia Letter Confusion"])
app.include_router(numberunderstanding_router, prefix="/numberunderstanding_test", tags=["Dyslexia Number Understanding"])
app.include_router(arithmetic_router, prefix="/arithmetic_test", tags=["Dyslexia Arithmetic"])

@app.get("/")
def root():
    return {"message": "EarlyEdge API is running!"}
