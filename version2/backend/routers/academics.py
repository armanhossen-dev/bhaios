"""University, Department, Semester, Course, and Chapter/Topic CRUD endpoints."""

from __future__ import annotations

import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import db_session, new_id, row_to_dict

router = APIRouter(prefix="/api/academics", tags=["academics"])


class UniversityCreate(BaseModel):
    name: str
    short_name: str = ""


class DepartmentCreate(BaseModel):
    university_id: str
    name: str
    code: str = ""


class SemesterCreate(BaseModel):
    department_id: str
    year_label: str = "2026-2027"
    name: str
    is_active: bool = True


class CourseCreate(BaseModel):
    semester_id: str
    code: str
    title: str
    instructor: str = ""
    credits: float = 3.0
    syllabus: str = ""
    description: str = ""
    objectives: str = ""
    exam_date: str | None = None


class CourseUpdate(BaseModel):
    code: str | None = None
    title: str | None = None
    instructor: str | None = None
    credits: float | None = None
    syllabus: str | None = None
    description: str | None = None
    objectives: str | None = None
    exam_date: str | None = None


class TopicCreate(BaseModel):
    title: str
    chapter_index: int = 1
    summary: str = ""


class TopicUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    status: str | None = None


@router.get("/tree")
def get_academic_tree() -> dict:
    with db_session() as conn:
        universities = [row_to_dict(r) for r in conn.execute("SELECT * FROM universities ORDER BY created_at ASC").fetchall()]
        departments = [row_to_dict(r) for r in conn.execute("SELECT * FROM departments ORDER BY created_at ASC").fetchall()]
        years = [row_to_dict(r) for r in conn.execute("SELECT * FROM academic_years ORDER BY created_at ASC").fetchall()]
        semesters = [row_to_dict(r) for r in conn.execute("SELECT * FROM semesters ORDER BY created_at DESC").fetchall()]
        courses = [
            row_to_dict(r)
            for r in conn.execute(
                """
                SELECT c.*,
                    (SELECT COUNT(*) FROM documents d WHERE d.course_id = c.id) AS doc_count,
                    (SELECT COUNT(*) FROM course_topics t WHERE t.course_id = c.id) AS topic_count,
                    (SELECT COUNT(*) FROM tasks tk WHERE tk.course_id = c.id AND tk.completed = 0) AS pending_tasks
                FROM courses c
                ORDER BY c.created_at DESC
                """
            ).fetchall()
        ]
    return {
        "universities": universities,
        "departments": departments,
        "academic_years": years,
        "semesters": semesters,
        "courses": courses,
    }


@router.post("/universities")
def create_university(req: UniversityCreate) -> dict:
    uid = new_id("uni")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            "INSERT INTO universities (id, name, short_name, created_at) VALUES (?, ?, ?, ?)",
            (uid, req.name.strip(), req.short_name.strip(), now),
        )
        row = conn.execute("SELECT * FROM universities WHERE id = ?", (uid,)).fetchone()
    return row_to_dict(row) or {}


@router.post("/departments")
def create_department(req: DepartmentCreate) -> dict:
    did = new_id("dept")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            "INSERT INTO departments (id, university_id, name, code, created_at) VALUES (?, ?, ?, ?, ?)",
            (did, req.university_id, req.name.strip(), req.code.strip(), now),
        )
        row = conn.execute("SELECT * FROM departments WHERE id = ?", (did,)).fetchone()
    return row_to_dict(row) or {}


@router.post("/semesters")
def create_semester(req: SemesterCreate) -> dict:
    now = time.time()
    with db_session() as conn:
        yr = conn.execute(
            "SELECT id FROM academic_years WHERE department_id = ? AND label = ?",
            (req.department_id, req.year_label.strip()),
        ).fetchone()
        if yr:
            yid = yr["id"]
        else:
            yid = new_id("yr")
            conn.execute(
                "INSERT INTO academic_years (id, department_id, label, created_at) VALUES (?, ?, ?, ?)",
                (yid, req.department_id, req.year_label.strip(), now),
            )
        if req.is_active:
            conn.execute("UPDATE semesters SET is_active = 0")
        sid = new_id("sem")
        conn.execute(
            "INSERT INTO semesters (id, academic_year_id, name, is_active, created_at) VALUES (?, ?, ?, ?, ?)",
            (sid, yid, req.name.strip(), 1 if req.is_active else 0, now),
        )
        row = conn.execute("SELECT * FROM semesters WHERE id = ?", (sid,)).fetchone()
    return row_to_dict(row) or {}


@router.get("/courses")
def list_courses(semester_id: str | None = None) -> list[dict]:
    with db_session() as conn:
        sql = """
            SELECT c.*,
                s.name AS semester_name,
                (SELECT COUNT(*) FROM documents d WHERE d.course_id = c.id) AS doc_count,
                (SELECT COUNT(*) FROM course_topics t WHERE t.course_id = c.id) AS topic_count,
                (SELECT COUNT(*) FROM tasks tk WHERE tk.course_id = c.id AND tk.completed = 0) AS pending_tasks
            FROM courses c
            LEFT JOIN semesters s ON s.id = c.semester_id
        """
        params: tuple = ()
        if semester_id:
            sql += " WHERE c.semester_id = ?"
            params = (semester_id,)
        sql += " ORDER BY c.created_at DESC"
        rows = conn.execute(sql, params).fetchall()
    return [row_to_dict(r) for r in rows if r]


@router.post("/courses")
def create_course(req: CourseCreate) -> dict:
    cid = new_id("crs")
    now = time.time()
    with db_session() as conn:
        conn.execute(
            """
            INSERT INTO courses (id, semester_id, code, title, instructor, credits, syllabus, description, objectives, exam_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cid,
                req.semester_id,
                req.code.strip().upper(),
                req.title.strip(),
                req.instructor.strip(),
                req.credits,
                req.syllabus,
                req.description,
                req.objectives,
                req.exam_date,
                now,
            ),
        )
        # Auto-seed topics from syllabus lines if provided
        lines = [ln.strip(" -•*\t") for ln in req.syllabus.splitlines() if ln.strip()]
        for idx, line in enumerate(lines[:20], start=1):
            conn.execute(
                "INSERT INTO course_topics (id, course_id, chapter_index, title, created_at) VALUES (?, ?, ?, ?, ?)",
                (new_id("top"), cid, idx, line[:120], now),
            )
        row = conn.execute("SELECT * FROM courses WHERE id = ?", (cid,)).fetchone()
    return row_to_dict(row) or {}


@router.get("/courses/{course_id}")
def get_course_detail(course_id: str) -> dict:
    with db_session() as conn:
        course = conn.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        topics = conn.execute(
            "SELECT * FROM course_topics WHERE course_id = ? ORDER BY chapter_index ASC, created_at ASC",
            (course_id,),
        ).fetchall()
        docs = conn.execute(
            "SELECT * FROM documents WHERE course_id = ? ORDER BY created_at DESC", (course_id,)
        ).fetchall()
        tasks = conn.execute(
            "SELECT * FROM tasks WHERE course_id = ? ORDER BY completed ASC, created_at DESC",
            (course_id,),
        ).fetchall()
        chats = conn.execute(
            "SELECT * FROM chats WHERE course_id = ? ORDER BY updated_at DESC", (course_id,)
        ).fetchall()
    result = row_to_dict(course) or {}
    result["topics"] = [row_to_dict(t) for t in topics if t]
    result["documents"] = [row_to_dict(d) for d in docs if d]
    result["tasks"] = [row_to_dict(tk) for tk in tasks if tk]
    result["chats"] = [row_to_dict(c) for c in chats if c]
    return result


@router.patch("/courses/{course_id}")
def update_course(course_id: str, req: CourseUpdate) -> dict:
    with db_session() as conn:
        existing = conn.execute("SELECT id FROM courses WHERE id = ?", (course_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Course not found")
        updates, values = [], []
        for field in ("code", "title", "instructor", "credits", "syllabus", "description", "objectives", "exam_date"):
            val = getattr(req, field)
            if val is not None:
                updates.append(f"{field} = ?")
                values.append(val)
        if updates:
            values.append(course_id)
            conn.execute(f"UPDATE courses SET {', '.join(updates)} WHERE id = ?", tuple(values))
        row = conn.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone()
    return row_to_dict(row) or {}


@router.delete("/courses/{course_id}")
def delete_course(course_id: str) -> dict:
    with db_session() as conn:
        cur = conn.execute("DELETE FROM courses WHERE id = ?", (course_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Course not found")
    return {"deleted": course_id}


@router.post("/courses/{course_id}/topics")
def add_course_topic(course_id: str, req: TopicCreate) -> dict:
    tid = new_id("top")
    now = time.time()
    with db_session() as conn:
        if not conn.execute("SELECT id FROM courses WHERE id = ?", (course_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Course not found")
        conn.execute(
            "INSERT INTO course_topics (id, course_id, chapter_index, title, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (tid, course_id, req.chapter_index, req.title.strip(), req.summary, now),
        )
        row = conn.execute("SELECT * FROM course_topics WHERE id = ?", (tid,)).fetchone()
    return row_to_dict(row) or {}


@router.patch("/topics/{topic_id}")
def update_topic(topic_id: str, req: TopicUpdate) -> dict:
    with db_session() as conn:
        if not conn.execute("SELECT id FROM course_topics WHERE id = ?", (topic_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Topic not found")
        updates, values = [], []
        for field in ("title", "summary", "status"):
            val = getattr(req, field)
            if val is not None:
                updates.append(f"{field} = ?")
                values.append(val)
        if updates:
            values.append(topic_id)
            conn.execute(f"UPDATE course_topics SET {', '.join(updates)} WHERE id = ?", tuple(values))
        row = conn.execute("SELECT * FROM course_topics WHERE id = ?", (topic_id,)).fetchone()
    return row_to_dict(row) or {}


@router.post("/sample-setup")
def create_sample_university() -> dict:
    """Optional one-click sample university setup (never hardcoded or forced on startup)."""
    now = time.time()
    with db_session() as conn:
        existing = conn.execute("SELECT COUNT(*) FROM courses").fetchone()[0]
        if existing > 0:
            return {"created": False, "message": "Courses already exist."}
        uid = new_id("uni")
        did = new_id("dept")
        yid = new_id("yr")
        sid = new_id("sem")
        conn.execute(
            "INSERT INTO universities (id, name, short_name, created_at) VALUES (?, ?, ?, ?)",
            (uid, "Sample State University", "SSU", now),
        )
        conn.execute(
            "INSERT INTO departments (id, university_id, name, code, created_at) VALUES (?, ?, ?, ?, ?)",
            (did, uid, "Computer Science & Engineering", "CSE", now),
        )
        conn.execute(
            "INSERT INTO academic_years (id, department_id, label, created_at) VALUES (?, ?, ?, ?)",
            (yid, did, "3rd Year", now),
        )
        conn.execute(
            "INSERT INTO semesters (id, academic_year_id, name, is_active, created_at) VALUES (?, ?, ?, 1, ?)",
            (sid, yid, "Fall 2026", now),
        )
        samples = [
            ("CSE-301", "Operating Systems", "Dr. Karim", 3.0, "1. Process Management & Threads\n2. CPU Scheduling\n3. Deadlocks & Synchronization\n4. Virtual Memory & Paging"),
            ("CSE-305", "Data Structures & Algorithms", "Prof. Rahman", 3.0, "1. Asymptotic Complexity\n2. Trees & Graphs\n3. Dynamic Programming\n4. Greedy Algorithms"),
        ]
        for code, title, inst, cr, syl in samples:
            cid = new_id("crs")
            conn.execute(
                "INSERT INTO courses (id, semester_id, code, title, instructor, credits, syllabus, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (cid, sid, code, title, inst, cr, syl, now),
            )
            for idx, ln in enumerate(syl.splitlines(), start=1):
                conn.execute(
                    "INSERT INTO course_topics (id, course_id, chapter_index, title, created_at) VALUES (?, ?, ?, ?, ?)",
                    (new_id("top"), cid, idx, ln, now),
                )
    return {"created": True, "message": "Sample CS semester and 2 courses created."}
