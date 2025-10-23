from google.cloud import storage
import os

MODEL_DIR = "/app/model"
BUCKET = "aiqwe123qweqwe123"
BLOB = "merged-llm"

def download_model():
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR, exist_ok=True)
        print("Downloading model from GCS...")
        client = storage.Client()
        bucket = client.bucket(BUCKET)
        blobs = bucket.list_blobs(prefix=BLOB)
        for blob in blobs:
            rel_path = os.path.relpath(blob.name, BLOB)
            local_path = os.path.join(MODEL_DIR, rel_path)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            blob.download_to_filename(local_path)

if __name__ == "__main__":
    download_model()