from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Data Analyzer API"
    api_prefix: str = "/api/v1"
    frontend_origins: str = "http://localhost:8000,http://127.0.0.1:5500,https://argeliovigoa.github.io"
    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    max_upload_mb: int = 25
    database_url: str = "sqlite:///./data_analyzer.db"
    jwt_secret_key: str = "LOCAL-ONLY-change-this-secret-before-deployment"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    environment: str = "development"
    rate_limit: str = "30/minute"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [x.strip() for x in self.frontend_origins.split(",") if x.strip()]

    @property
    def host_names(self) -> list[str]:
        return [x.strip() for x in self.allowed_hosts.split(",") if x.strip()]

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.environment.lower() == "production":
            if self.jwt_secret_key.startswith("LOCAL-ONLY") or len(self.jwt_secret_key) < 32:
                raise ValueError("Set a random JWT_SECRET_KEY of at least 32 characters in production.")
            if self.database_url.startswith("sqlite"):
                raise ValueError("Production requires a persistent PostgreSQL DATABASE_URL.")
        return self

settings = Settings()
