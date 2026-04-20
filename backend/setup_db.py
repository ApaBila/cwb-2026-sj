from app.database import engine, Base
from app.models import Task

print("Connecting to Azure PostgreSQL...")

print("WARNINNG: Dropping old tables...")
Base.metadata.drop_all(bind=engine)

Base.metadata.create_all(bind=engine)

print("Tables created successfully!")
