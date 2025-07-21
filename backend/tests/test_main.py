import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app" in data
    assert "version" in data


def test_get_opportunities():
    """Test the opportunities endpoint."""
    response = client.get("/api/opportunities/")
    assert response.status_code == 200
    # Should return empty list initially
    assert isinstance(response.json(), list)