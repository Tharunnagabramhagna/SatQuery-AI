"""Unit tests for Block 1: Backend API Foundation."""

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_endpoint():
    """Test GET /api/health returns 200 and correct health payload."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "satquery-api"
    assert data["version"] == "0.1.0"


def test_root_endpoint():
    """Test GET / returns 200 and service metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    assert "health" in data["endpoints"]
    assert "query" in data["endpoints"]


def test_post_query_valid():
    """Test POST /api/query returns 200 with received_query and status."""
    test_query = "What objects are present in this satellite image?"
    response = client.post("/api/query", json={"query": test_query})
    assert response.status_code == 200
    data = response.json()
    assert data["received_query"] == test_query
    assert data["status"] == "received"


def test_post_query_whitespace_trimmed():
    """Test POST /api/query strips extraneous whitespace."""
    test_query = "   Find all water bodies   "
    response = client.post("/api/query", json={"query": test_query})
    assert response.status_code == 200
    data = response.json()
    assert data["received_query"] == "Find all water bodies"
    assert data["status"] == "received"


def test_post_query_empty_rejected():
    """Test POST /api/query with empty string returns 422."""
    response = client.post("/api/query", json={"query": ""})
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"
    assert data["error_type"] == "validation_error"


def test_post_query_whitespace_only_rejected():
    """Test POST /api/query with whitespace-only string returns 422."""
    response = client.post("/api/query", json={"query": "    "})
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"
    assert data["error_type"] == "validation_error"


def test_post_query_missing_field_rejected():
    """Test POST /api/query with missing query field returns 422."""
    response = client.post("/api/query", json={})
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"
    assert data["error_type"] == "validation_error"
