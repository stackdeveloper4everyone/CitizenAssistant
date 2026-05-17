from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    app_name: str = "Citizen Service Assistant"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000
    api_prefix: str = "/api"

    sarvam_api_key: str = Field(default="")
    sarvam_base_url: str = "https://api.sarvam.ai"
    sarvam_chat_model: str = "sarvam-105b"
    sarvam_chat_max_tokens: int = 900
    sarvam_chat_timeout_seconds: int = 45
    sarvam_translation_target: str = "en-IN"
    sarvam_stt_model: str = "saaras:v3"
    sarvam_tts_model: str = "bulbul:v3"
    sarvam_tts_speaker: str = "shubh"

    tavily_api_key: str = Field(default="")

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = Field(default="", alias="QDRANT_API_KEY")
    qdrant_collection: str = "citizen_policy_knowledge"
    qdrant_embedding_model: str = "BAAI/bge-base-en-v1.5"
    qdrant_use_hash_fallback: bool = Field(default=False, alias="QDRANT_USE_HASH_FALLBACK")

    mem0_api_key: str = Field(default="")
    mem0_org_id: str = Field(default="")
    mem0_project_id: str = Field(default="")

    allowed_origins_raw: str = Field(
        default="http://127.0.0.1:8000,http://localhost:8000",
        alias="ALLOWED_ORIGINS",
    )
    trusted_search_domains_raw: str = Field(
        default="gov.in,nic.in,india.gov.in,myscheme.gov.in",
        alias="TRUSTED_SEARCH_DOMAINS",
    )
    rate_limit_per_minute: int = 30

    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        origins = [item.strip() for item in self.allowed_origins_raw.split(",") if item.strip()]
        render_url = os.getenv("RENDER_EXTERNAL_URL", "").strip()
        if render_url and render_url not in origins:
            origins.append(render_url)
        return origins

    @property
    def trusted_search_domains(self) -> list[str]:
        return [item.strip() for item in self.trusted_search_domains_raw.split(",") if item.strip()]

    @property
    def frontend_dir(self) -> Path:
        return REPO_ROOT / "frontend"

    @property
    def data_dir(self) -> Path:
        return REPO_ROOT / "data"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
