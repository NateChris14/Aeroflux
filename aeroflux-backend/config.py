from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    OPENSKY_CLIENT_ID: str = ""
    OPENSKY_CLIENT_SECRET: str = ""
    OPENSKY_ICAO24: str = "aa1234"
    OPENSKY_MODE: str = "simulation"
    TICK_INTERVAL_S: int = 5
    LOG_LEVEL: str = "INFO"

    # Legacy Ollama Configuration (deprecated, use LLM_* vars)
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    USE_LLM_AGENTS: bool = True  # Enable LLM for all agents

    # Unified LLM Configuration (LiteLLM-style)
    LLM_PROVIDER: str = "ollama"  # ollama, groq, openai
    LLM_API_KEY: str = ""  # Required for groq, openai
    LLM_MODEL: str = ""  # Defaults: llama3.2 (ollama), llama3-8b-8192 (groq), gpt-3.5-turbo (openai)
    LLM_URL: str = ""  # Custom base URL (optional)
    LLM_TEMPERATURE: float = 0.3
    LLM_MAX_TOKENS: int = 500

    class Config:
        env_file = ".env"


settings = Settings()
