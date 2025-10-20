import re
from fastapi import FastAPI, Request
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

app = FastAPI()

# 模型的本地路徑（已經打包進 Docker image）
LOCAL_PATH = "/app/model"

def extract_first_answer(text: str) -> str:
    m = re.search(r"<answer>(.*?)</answer>", text, flags=re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m2 = re.search(r"<answer>(.*)", text, flags=re.DOTALL | re.IGNORECASE)
    if m2:
        return m2.group(1).strip()
    return re.sub(r"</?[^>]+>", "", text).strip()

# 直接從本地載入 Hugging Face 模型
tokenizer = AutoTokenizer.from_pretrained(LOCAL_PATH)
model = AutoModelForCausalLM.from_pretrained(
    LOCAL_PATH,
    dtype="auto",
    device_map="auto"
)
model.eval()

@app.get("/")
async def root():
    return {"status": "ok"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/predict")
async def predict(request: Request):
    body = await request.json()
    instances = body.get("instances", [])
    prompt = instances[0].get("text", "") if instances else ""

    if not prompt:
        return {"predictions": [{"output": "⚠️ 沒有輸入文字"}]} 

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            min_new_tokens=10,
            max_new_tokens=128,
        )
    result_raw = tokenizer.decode(outputs[0], skip_special_tokens=True)
    result = extract_first_answer(result_raw)

    return {"predictions": [{"output": result}]}