# agent/runtime.py
from typing import Optional

generative_model: Optional[object] = None

def set_model(model):
    global generative_model
    generative_model = model

def get_model():
    return generative_model