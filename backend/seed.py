from datetime import date
from app.database import SessionLocal
from app.models import Task

baseline_tasks = [
    # Phase 1: Pre-Construction & Approvals
    Task(task="Environmental Impact Assessment", owner="Dr. Maria", due_date_raw="March 1, 2026", due_date_iso=date(2026, 3, 1),
         status="Done", dependency=None, source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Zoning Board Approval", owner="Doreen", due_date_raw="March 15, 2026", due_date_iso=date(2026, 3, 15), status="Done",
         dependency="Environmental Impact Assessment", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Finalize Architectural Blueprints", owner="Julia", due_date_raw="April 5, 2026", due_date_iso=date(2026, 4, 5),
         status="Done", dependency=None, source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Procure Steel Supply", owner="Fatemeh", due_date_raw="April 10, 2026", due_date_iso=date(2026, 4, 10), status="Done",
         dependency="Finalize Architectural Blueprints", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Contractor Site Mobilization", owner="David", due_date_raw="April 12, 2026", due_date_iso=date(2026, 4, 12), status="In Progress",
         dependency="Zoning Board Approval", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),

    # Phase 2: Foundation & Framework
    Task(task="Site Clearing and Excavation", owner="David", due_date_raw="April 14, 2026", due_date_iso=date(2026, 4, 14), status="In Progress",
         dependency="Contractor Site Mobilization", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Pour Concrete Foundation", owner="David", due_date_raw="April 20, 2026", due_date_iso=date(2026, 4, 20), status="Not Started",
         dependency="Site Clearing and Excavation", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Foundation Curing Period", owner="Unassigned", due_date_raw="April 27, 2026", due_date_iso=date(2026, 4, 27), status="Not Started",
         dependency="Pour Concrete Foundation", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Underground Utilities Routing", owner="Chris", due_date_raw="May 2, 2026", due_date_iso=date(2026, 5, 2), status="Not Started",
         dependency="Pour Concrete Foundation", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Erect Main Steel Framework", owner="Sarah", due_date_raw="May 15, 2026", due_date_iso=date(2026, 5, 15), status="Not Started",
         dependency="Foundation Curing Period", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),

    # Phase 3: Infrastructure & Systems
    Task(task="Roofing Installation", owner="Sarah", due_date_raw="June 5, 2026", due_date_iso=date(2026, 6, 5), status="Not Started",
         dependency="Erect Main Steel Framework", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="HVAC System Installation", owner="Michael", due_date_raw="June 20, 2026", due_date_iso=date(2026, 6, 20), status="Not Started",
         dependency="Roofing Installation", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Electrical Main Wiring", owner="Michael", due_date_raw="July 1, 2026", due_date_iso=date(2026, 7, 1), status="Not Started",
         dependency="Roofing Installation", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Plumbing Mains", owner="Chris", due_date_raw="July 1, 2026", due_date_iso=date(2026, 7, 1), status="Not Started",
         dependency="Underground Utilities Routing", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Elevator Shaft Construction", owner="Sarah", due_date_raw="July 15, 2026", due_date_iso=date(2026, 7, 15), status="Not Started",
         dependency="Erect Main Steel Framework", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),

    # Phase 4: Interiors & Finishing
    Task(task="Interior Drywall Setup", owner="Julia", due_date_raw="August 10, 2026", due_date_iso=date(2026, 8, 10), status="Not Started",
         dependency="HVAC System Installation", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Platform Tiling", owner="Fatemeh", due_date_raw="August 25, 2026", due_date_iso=date(2026, 8, 25), status="Not Started",
         dependency="Interior Drywall Setup", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),
    Task(task="Turnstile & Ticketing Systems", owner="Ikhlas", due_date_raw="September 5, 2026", due_date_iso=date(2026, 9, 5), status="Not Started",
         dependency="Electrical Main Wiring", source="Project Charter", confidence="High", action_type="new_task", is_approved=True),

    # Phase 5: Testing & Handover
    Task(task="Safety Inspection Phase 1", owner="Unassigned", due_date_raw="Unspecified", due_date_iso=None, status="Not Started",
         dependency=None, source="Project Charter", confidence="Low", action_type="conflict_needs_clarification", is_approved=True),
    Task(task="City Handover Certification", owner="Doreen", due_date_raw="October 1, 2026", due_date_iso=date(2026, 10, 1), status="Not Started",
         dependency="Safety Inspection Phase 1", source="Project Charter", confidence="Medium", action_type="new_task", is_approved=True),
]

print("Seeding baseline data to Azure...")
db = SessionLocal()
try:
    db.add_all(baseline_tasks)
    db.commit()
    print(f"Successfully seeded {len(baseline_tasks)} baseline tasks!")
except Exception as e:
    db.rollback()
    print(f"Error seeding data: {e}")
finally:
    db.close()
