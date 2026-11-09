"""Pruebas de la instalación de MegaBot en Android / POCO."""
from fastapi.testclient import TestClient
from tests.test_smoke import F  # Base temporal SQLite compartida por la suite.
from app.main import app


def test_mobile_install_assets_are_public_but_data_remains_private():
    with TestClient(app) as client:
        home = client.get("/")
        assert home.status_code == 200
        assert 'id="pwaLoginInstall"' in home.text
        assert 'id="pwaInstallBanner"' in home.text
        assert 'rel="manifest"' in home.text

        worker = client.get("/sw.js")
        assert worker.status_code == 200
        assert worker.headers["service-worker-allowed"] == "/"
        assert "javascript" in worker.headers["content-type"]
        assert "caches.open(OFFLINE_CACHE)" in worker.text
        assert "event.request.mode!=='navigate'" in worker.text
        assert "cache.put" not in worker.text

        manifest_resp = client.get("/static/manifest.webmanifest")
        assert manifest_resp.status_code == 200
        manifest = manifest_resp.json()
        assert manifest["display"] == "standalone"
        assert manifest["id"] == "/"
        assert manifest["lang"] == "es-BO"
        assert any("192x192" in icon["sizes"] for icon in manifest["icons"])
        assert any("512x512" in icon["sizes"] for icon in manifest["icons"])

        for resource in ("/static/megabot-icon-192.webp",
                         "/static/megabot-icon.webp",
                         "/static/offline.html"):
            assert client.get(resource).status_code == 200

        # Instalar la PWA no debe hacer públicos los productos ni la cuenta.
        assert client.get("/api/products").status_code == 401
