"""
会议路由 - D1 版本
所有查询添加 user_id 条件实现数据隔离
"""

from app.asgi_app import Router, HTTPException
from datetime import datetime

from app.core.database import get_db_from_env, D1Database
from app.core.security import get_current_active_user
from app.schemas.conference import ConferenceCreate, ConferenceUpdate

router = Router(prefix="/conferences")


def conference_to_dict(c: dict) -> dict:
    return {
        "id": c["id"],
        "code": c["code"],
        "title": c["title"],
        "date": c.get("start_date"),
        "scale": c.get("scale", 50),
        "purpose": c.get("purpose"),
        "schedule": c.get("schedule"),
        "start_date": c.get("start_date"),
        "end_date": c.get("end_date"),
        "location": c.get("location"),
        "has_meal": bool(c.get("has_meal", 0)),
        "has_hotel": bool(c.get("has_hotel", 0)),
        "has_transport": bool(c.get("has_transport", 0)),
        "year": c.get("year"),
        "status": c.get("status", "draft"),
        "created_at": c.get("created_at"),
        "updated_at": c.get("updated_at"),
    }


async def generate_conference_code(user_id: int, db: D1Database) -> str:
    now = datetime.now()
    year_suffix = str(now.year)[-2:]
    month = str(now.month).zfill(2)
    prefix = f"{year_suffix}{month}"

    result = await db.execute_one(
        "SELECT COUNT(*) as cnt FROM conferences WHERE user_id = ? AND code LIKE ?",
        [user_id, f"{prefix}%"]
    )
    count = dict(result)["cnt"] if result else 0
    seq = str(count + 1).zfill(3)
    return f"{prefix}{seq}"


def parse_date(date_str: str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except:
        return None


@router.post("/")
async def create_conference(req):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(ConferenceCreate)
    user_id = current_user["id"]

    code = await generate_conference_code(user_id, db)
    start_date = parse_date(data.start_date)
    end_date = parse_date(data.end_date)
    year = start_date.year if start_date else datetime.now().year

    result = await db.execute_run(
        """INSERT INTO conferences (user_id, code, title, purpose, scale, schedule, location,
           has_meal, has_hotel, has_transport, start_date, end_date, year)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [user_id, code, data.title, data.purpose, data.scale,
         data.schedule, data.location,
         int(data.has_meal), int(data.has_hotel), int(data.has_transport),
         str(start_date) if start_date else None, str(end_date) if end_date else None, year]
    )

    new_id = result["meta"]["last_row_id"]
    row = await db.execute_one("SELECT * FROM conferences WHERE id = ?", [new_id])
    return conference_to_dict(dict(row))


@router.get("/")
async def get_conferences(req):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    result = await db.execute(
        "SELECT * FROM conferences WHERE user_id = ? ORDER BY created_at DESC",
        [user_id]
    )
    conferences = [conference_to_dict(dict(r)) for r in result["results"]]
    return conferences


@router.get("/stats/summary")
async def get_stats_summary(req):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    conf_count = await db.execute_one(
        "SELECT COUNT(*) as cnt FROM conferences WHERE user_id = ?", [user_id]
    )
    part_count = await db.execute_one(
        "SELECT COUNT(*) as cnt FROM participants WHERE user_id = ?", [user_id]
    )
    task_count = await db.execute_one(
        "SELECT COUNT(*) as cnt FROM transport_tasks WHERE user_id = ?", [user_id]
    )

    return {
        "conference_count": dict(conf_count)["cnt"] if conf_count else 0,
        "participant_count": dict(part_count)["cnt"] if part_count else 0,
        "task_count": dict(task_count)["cnt"] if task_count else 0,
    }


@router.get("/{conference_id}")
async def get_conference(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    row = await db.execute_one(
        "SELECT * FROM conferences WHERE id = ? AND user_id = ?",
        [int(conference_id), user_id]
    )
    if not row:
        raise HTTPException(status_code=404, detail="会议不存在")
    return conference_to_dict(dict(row))


@router.put("/{conference_id}")
async def update_conference(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(ConferenceUpdate)
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT * FROM conferences WHERE id = ? AND user_id = ?",
        [int(conference_id), user_id]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="会议不存在")

    update_data = {k: v for k, v in vars(data).items() if v is not None}
    if "date" in update_data:
        del update_data["date"]

    if "start_date" in update_data and update_data["start_date"]:
        update_data["start_date"] = str(parse_date(update_data["start_date"]))
    if "end_date" in update_data and update_data["end_date"]:
        update_data["end_date"] = str(parse_date(update_data["end_date"]))

    # 布尔转整数
    for bool_field in ["has_meal", "has_hotel", "has_transport"]:
        if bool_field in update_data:
            update_data[bool_field] = int(update_data[bool_field])

    set_clauses = []
    params = []
    for field, value in update_data.items():
        set_clauses.append(f"{field} = ?")
        params.append(value)

    if set_clauses:
        params.append(int(conference_id))
        params.append(user_id)
        await db.execute_run(
            f"UPDATE conferences SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            params
        )

    row = await db.execute_one("SELECT * FROM conferences WHERE id = ?", [int(conference_id)])
    return conference_to_dict(dict(row))


@router.delete("/{conference_id}")
async def delete_conference(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT id FROM conferences WHERE id = ? AND user_id = ?",
        [int(conference_id), user_id]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="会议不存在")

    await db.execute_run("DELETE FROM conferences WHERE id = ? AND user_id = ?", [int(conference_id), user_id])
    return {"message": "会议删除成功"}
