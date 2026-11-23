from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Data Analyzer API"
    api_prefix: str = "/api/v1"
    frontend_origins: str = "http://localhost:8000,http://127.0.0.1:5500,https://argeliovigoa.github.io"
    max_upload_mb: int = 25
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [x.strip() for x in self.frontend_origins.split(",") if x.strip()]

settings = Settings()
