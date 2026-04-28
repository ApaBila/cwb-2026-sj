from sqlalchemy import Column, Integer, String, Date, Boolean
from .database import Base


class Task(Base):
    __tablename__ = "tasks"

    project_id = Column(Integer, default=None)
    project_name = Column(String, default="Unspecified")
    source_date_iso = Column(Date, nullable=True)
    project_timezone = Column(String, default="Unspecified")

    task_id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String, nullable=False, default="Unspecified")
    owner = Column(String, nullable=True, default=None)
    due_date_raw = Column(String, nullable=True, default=None)
    due_date_iso = Column(Date, nullable=True)

    status = Column(String, nullable=False, default="Not started")
    dependency = Column(String, nullable=True)

    source = Column(String, nullable=True)
    confidence = Column(String, nullable=True)
    action_type = Column(String, nullable=True)

    is_approved = Column(Boolean, default=False, index=True)


class Project(Base):
    __tablename__ = "projects"

# [Categorical/Text] project_id: Unique Values = { PRJ001 | PRJ002 | PRJ003 | PRJ004 }
# [Categorical/Text] project_name: Unique Values = { Harbour Bridge Expansion | Civic Office Expansion | Orchard Office Package B | Metro Mall Package B }
# [Categorical/Text] region: Unique Values = { AU-NSW | UK | HK }
# [Categorical/Text] start_date: Unique Values = { 2026-02-16 | 2026-01-24 | 2026-01-26 | 2026-04-08 }
# [Categorical/Text] target_end_date: Unique Values = { 2027-01-19 | 2026-11-04 | 2027-03-02 | 2026-12-09 }
# [Categorical/Text] contract_type: Unique Values = { Design }


class Dependency(Base):
    __tablename__ = "dependencies"
# [Categorical/Text] dependency_id: Unique Values = { D0001 | D0002 | D0003 | ..
# [Categorical/Text] predecessor_task_id: Unique Values = { T00135 | T00051 | T00121 ..
# [Categorical/Text] successor_task_id: Unique Values = ..
# [Categorical/Text] dependency_type: Unique Values = { FS | SS | FF }
# TODO: Find Gantt lib that can vis these types


class Person(Base):
    __tablename__ = "people"
# [Categorical/Text] person_id: Unique Values = { P001 | P002 | P003 | P004 | P005 | P006 | P007 | P008 | P009 | P010 | P011 | P012 | P013 | P014 | P015 | P016 | P017 | P018 }
# [Categorical/Text] display_name: Unique Values = {Sofia Ong | Aisha Ong | Grace Kaur | Lina Ong | Aisha Kaur | Grace Santos | Maya Wong | Ivy Chung | Lina Singh | Lina Tan | Sofia Singh | Ivy Santos | Mei Rahman | Chloe Ng | Farah Singh | Anika Chen | Chloe Lee | Rina Ali}
# [Categorical/Text] role: Unique Values = {Architect | Stakeholder | Project Controls | Cost Manager | Project Manager | Design Manager | BIM Coordinator | Structural Engineer | Planner}
# [Categorical/Text] discipline: Unique Values = {MEP | Architecture | PMO | Sustainability | Digital | Cost | Structural | Civil}
# [Categorical/Text] region: Unique Values = {UAE | AU-NSW | IN | AU-VIC | UK | SG | HK}
# [Categorical/Text] email: Unique Values = {sofia.ong1@example.org | aisha.ong2@example.org | grace.kaur3@example.org | lina.ong4@example.org | aisha.kaur5@example.org | grace.santos6@example.org | maya.wong7@example.org | ivy.chung8@example.org | lina.singh9@example.org | lina.tan10@example.org | sofia.singh11@example.org | ivy.santos12@example.org | mei.rahman13@example.org | chloe.ng14@example.org | farah.singh15@example.org | anika.chen16@example.org | chloe.lee17@example.org | rina.ali18@example.org}
