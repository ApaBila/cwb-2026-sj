from sqlalchemy import Column, Integer, String, Date, Boolean
from .database import Base


class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(String, primary_key=True, index=True)
    task_title = Column(String, nullable=False, default="Unspecified")
    source_date_iso = Column(Date, nullable=True)
    project_id = Column(String, index=True)

    owner_id = Column(String, nullable=True, default=None)
    owner_name = Column(String, nullable=True, default=None)

    # YYYY-MM-DD
    start_date_raw = Column(String, nullable=True, default=None)
    planned_start = Column(Date, nullable=True)
    due_date_raw = Column(String, nullable=True, default=None)
    planned_due = Column(Date, nullable=True)

    status = Column(String, nullable=False, default="Not started")
    dependency = Column(String, nullable=True)
    percent_complete = Column(Integer, default=None)
    priority = Column(String, nullable=False, default="Low")

    # notes = Column(String, nullable=True)
    source = Column(String, nullable=True)
    confidence = Column(String, nullable=True)
    action_type = Column(String, nullable=True)
    is_approved = Column(Boolean, default=False, index=True)


class Project(Base):
    __tablename__ = "projects"

    project_id = Column(String, primary_key=True, index=True)
    project_name = Column(String, default="Unspecified")
    project_timezone = Column(String, default="Unspecified")
    region = Column(String, default="Unspecified")
    start_date = Column(String, nullable=True, default=None)
    target_end_date = Column(String, nullable=True, default=None)
    contract_type = Column(String, nullable=True, default="Unspecified")


class Dependency(Base):
    __tablename__ = "dependencies"

    dependency_id = Column(String, primary_key=True, index=True)
    predecessor_task_id = Column(String, nullable=False, index=True)
    successor_task_id = Column(String, nullable=False, index=True)
    dependency_type = Column(String, nullable=False)  # FS, SS, FF
# TODO: Find Gantt lib that can vis these types


class Person(Base):
    __tablename__ = "people"

    person_id = Column(String, primary_key=True, index=True)
    display_name = Column(String, nullable=False)
    role = Column(String, nullable=True)
    discipline = Column(String, nullable=True)
    region = Column(String, nullable=True)
    email = Column(String, nullable=True)
