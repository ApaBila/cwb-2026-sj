from sqlalchemy import Column, Integer, String, Date, Boolean
from .database import Base


class Task(Base):
    __tablename__ = "tasks"

    project = Column(String, default="Unspecified")
    source_date_iso = Column(Date, nullable=True)
    project_timezone = Column(String, default="Unspecified")

    id = Column(Integer, primary_key=True, index=True)

    task = Column(String, nullable=False, default="Unspecified")
    owner = Column(String, default="Unassigned")
    due_date_raw = Column(String, default="Unspecified")
    due_date_iso = Column(Date, nullable=True)

    status = Column(String, nullable=False, default="Not Started")
    dependency = Column(String, nullable=True)

    source = Column(String, nullable=True)
    confidence = Column(String, nullable=True)
    action_type = Column(String, nullable=True)

    is_approved = Column(Boolean, default=False, index=True)
