import streamlit as st
import subprocess
import threading
import time
import os
import requests
import sys

OLLAMA_CMD = "ollama"
OLLAMA_DOWNLOAD_URL = "https://ollama.com/download/OllamaSetup.exe"
OLLAMA_INSTALLER = "OllamaSetup.exe"
OLLAMA_API_URL = "http://localhost:11434/api/tags"

# 預設 Ollama 的模型快取目錄
OLLAMA_MODELS_DIR = os.path.expanduser("~/.ollama/models")


def is_ollama_installed():
    try:
        result = subprocess.run([OLLAMA_CMD, "--version"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False


def install_ollama():
    st.warning("⚠️ 檢查到未安裝 Ollama，正在下載安裝檔...")
    if not os.path.exists(OLLAMA_INSTALLER):
        try:
            with requests.get(OLLAMA_DOWNLOAD_URL, stream=True) as r:
                r.raise_for_status()
                with open(OLLAMA_INSTALLER, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
            st.success(f"✅ 已下載 Ollama 安裝檔：{OLLAMA_INSTALLER}")
        except Exception as e:
            st.error(f"❌ 下載 Ollama 失敗: {e}")
            return False

    st.info("📦 請手動執行安裝程式，安裝完成後重新啟動啟動器。")
    os.startfile(OLLAMA_INSTALLER)
    return False


def wait_for_ollama():
    """等待 Ollama API 啟動"""
    for _ in range(30):
        try:
            resp = requests.get(OLLAMA_API_URL, timeout=2)
            if resp.status_code == 200:
                return True
        except requests.exceptions.RequestException:
            pass
        time.sleep(1)
    return False


def list_installed_models():
    try:
        result = subprocess.run([OLLAMA_CMD, "list"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        models = []
        for line in result.stdout.strip().split("\n")[1:]:
            if line:
                models.append(line.split()[0])
        return models
    except Exception:
        return []


def is_model_cached(model_name: str) -> bool:
    """檢查本地是否已有模型快取檔"""
    if not os.path.exists(OLLAMA_MODELS_DIR):
        return False

    for root, dirs, files in os.walk(OLLAMA_MODELS_DIR):
        for file in files:
            if model_name.replace(":", "_") in file:  # qwen3:8b → qwen3_8b
                return True
    return False


def pull_model(model_name):
    """下載模型，並顯示進度條"""
    st.info(f"📥 正在安裝模型 {model_name} ...")
    progress_bar = st.progress(0)
    status_text = st.empty()

    process = subprocess.Popen(
        [OLLAMA_CMD, "pull", model_name],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",   # ✅ 用 UTF-8 解碼
        errors="ignore"     # ✅ 遇到無法解碼的字元直接忽略
    )

    line_count = 0
    for line in process.stdout:
        line_count += 1
        status_text.text(line.strip())
        progress_bar.progress(min(line_count % 100, 100) / 100.0)

    process.wait()
    if process.returncode == 0:
        progress_bar.progress(1.0)
        st.success(f"✅ 模型 {model_name} 安裝完成")
        return True
    else:
        st.error(f"❌ 模型 {model_name} 安裝失敗")
        return False


def run_ollama():
    st.write("🟢 啟動 Ollama server ...")
    subprocess.Popen([OLLAMA_CMD, "serve"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def run_web_ui():
    st.write("🟢 啟動 Web UI ...")
    subprocess.Popen(
        [sys.executable, "-m", "streamlit", "run", "web_contract_ui_local.py"],
        shell=True
    )


# -------------------- Streamlit UI --------------------
st.title("🚀 本地 AI 啟動器")

if not is_ollama_installed():
    st.error("❌ 尚未安裝 Ollama")
    if st.button("下載並安裝 Ollama"):
        install_ollama()
    st.stop()

COMMON_MODELS = ["qwen3:8b", "qwen3:4b", "llama3:8b", "mistral:7b"]
installed_models = list_installed_models()
model_choice = st.selectbox("請選擇要啟動的 Ollama 模型：", COMMON_MODELS)

if st.button("啟動系統"):
    st.success(f"已選擇模型：{model_choice}")

    threading.Thread(target=run_ollama, daemon=True).start()

    if wait_for_ollama():
        st.success("✅ Ollama API 已啟動！")

        if model_choice not in installed_models and not is_model_cached(model_choice):
            ok = pull_model(model_choice)
            if not ok:
                st.stop()
            else:
                st.info("🔄 模型安裝完成，正在重啟 Web UI...")
                time.sleep(2)

        threading.Thread(target=run_web_ui, daemon=True).start()

    else:
        st.error("❌ Ollama API 啟動失敗，請檢查安裝是否正常。")

