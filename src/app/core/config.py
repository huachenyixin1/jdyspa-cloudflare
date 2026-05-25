import os


class Settings:
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_HOURS = 24
    ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")


settings = Settings()
