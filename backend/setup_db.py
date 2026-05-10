from app.database import Base, engine

print("Connecting to Azure PostgreSQL...")

print("WARNING: Dropping old tables...")
Base.metadata.drop_all(bind=engine)

Base.metadata.create_all(bind=engine)

print("Tables created successfully!")
