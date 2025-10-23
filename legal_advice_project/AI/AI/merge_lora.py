from transformers import AutoTokenizer
from transformers import Gemma3ForConditionalGeneration  # 需要最新 transformers
from peft import PeftModel

base_model_path = "./models/gemma-3-4b-it"      # 你的 Gemma3 base model
adapter_model_path = "./smellts"  # LoRA adapter
save_path = "./merged-llm"        # 輸出合併後的模型

print("🔹 載入 base model...")
model = Gemma3ForConditionalGeneration.from_pretrained(
    base_model_path,
    torch_dtype="auto",
    device_map="auto"
)

print("🔹 套用 LoRA adapter...")
model = PeftModel.from_pretrained(model, adapter_model_path)

print("🔹 合併 LoRA 權重...")
model = model.merge_and_unload()

print("🔹 儲存合併後的模型...")
model.save_pretrained(save_path)

tokenizer = AutoTokenizer.from_pretrained(base_model_path)
tokenizer.save_pretrained(save_path)

print(f"✅ 完成！合併後的模型已儲存到 {save_path}")