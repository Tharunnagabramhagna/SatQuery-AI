"""Unit tests for the Datasets API and Scenario Ingestion."""

from __future__ import annotations

import io
import zipfile
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app

client = TestClient(app)


def _create_dummy_image_bytes() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color="blue")
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_list_datasets():
    response = client.get("/api/datasets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    # Check that required fields are present
    assert "id" in data[0]
    assert "title" in data[0]
    assert "capability" in data[0]


def test_upload_dataset_zip_success():
    # Create a small valid zip in memory containing 2 PNGs
    zip_buf = io.BytesIO()
    img_bytes = _create_dummy_image_bytes()

    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr("test_scene_01.png", img_bytes)
        zf.writestr("test_scene_02.png", img_bytes)

    zip_buf.seek(0)

    response = client.post(
        "/api/datasets/upload",
        files={"file": ("test_custom_dataset.zip", zip_buf.getvalue(), "application/zip")},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["totalImages"] == 2
    assert "test_custom_dataset" in data["datasetId"]


def test_upload_dataset_invalid_format():
    response = client.post(
        "/api/datasets/upload",
        files={"file": ("test_file.txt", b"plain text content", "text/plain")},
    )
    assert response.status_code == 400
