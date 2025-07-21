from sqlmodel import SQLModel, create_engine
from app.config import settings
import structlog

logger = structlog.get_logger()

# Create database engine
engine = create_engine(settings.database_url, echo=settings.debug)

def create_db_and_tables():
    """Create database and tables."""
    logger.info("Creating database tables", database_url=settings.database_url)
    SQLModel.metadata.create_all(engine)