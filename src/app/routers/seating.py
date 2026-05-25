"""
座位管理路由 - D1 版本
"""

from app.asgi_app import Router, HTTPException
from datetime import datetime

from app.core.database import get_db_from_env
from app.core.security import get_current_active_user
from app.schemas.seating import (
    AreaCreate, AreaUpdate, AreaPositionUpdate,
    SeatAssign, SwapRequest, AutoAssignRequest, PriorityConfig
)

router = Router(prefix="/api/seating")


@router.get("/{conference_id}/areas")
async def get_areas(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    result = await db.execute(
        "SELECT * FROM seating_areas WHERE user_id = ? AND conference_id = ? ORDER BY position_y, position_x",
        [user_id, int(conference_id)]
    )
    areas = [dict(r) for r in result["results"]]

    # 获取每个区域的座位分配
    for area in areas:
        assignments = await db.execute(
            """SELECT sa.*, p.name as participant_name, p.company, p.department, p.position, p.title
               FROM seating_assignments sa
               LEFT JOIN participants p ON sa.participant_id = p.id
               WHERE sa.user_id = ? AND sa.area_id = ?""",
            [user_id, area["id"]]
        )
        area["assignments"] = [dict(r) for r in assignments["results"]]

    return areas


@router.post("/{conference_id}/areas")
async def create_area(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(AreaCreate)
    user_id = current_user["id"]

    import json
    config_str = json.dumps(data.config) if isinstance(data.config, dict) else data.config

    result = await db.execute_run(
        """INSERT INTO seating_areas (user_id, conference_id, name, area_type, config, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [user_id, int(conference_id), data.name, data.area_type, config_str,
         data.position_x, data.position_y]
    )

    new_id = result["meta"]["last_row_id"]
    row = await db.execute_one("SELECT * FROM seating_areas WHERE id = ?", [new_id])
    area = dict(row)
    area["assignments"] = []
    return area


@router.put("/{conference_id}/areas/{area_id}")
async def update_area(req, conference_id: str, area_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(AreaUpdate)
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT id FROM seating_areas WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(area_id), user_id, int(conference_id)]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="区域不存在")

    update_data = {k: v for k, v in vars(data).items() if v is not None}
    set_clauses = []
    params = []
    for key, value in update_data.items():
        if key == "config" and isinstance(value, dict):
            import json
            value = json.dumps(value)
        set_clauses.append(f"{key} = ?")
        params.append(value)

    if set_clauses:
        params.append(int(area_id))
        params.append(user_id)
        await db.execute_run(
            f"UPDATE seating_areas SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?",
            params
        )

    row = await db.execute_one("SELECT * FROM seating_areas WHERE id = ?", [int(area_id)])
    return dict(row)


@router.put("/{conference_id}/areas/positions")
async def update_area_positions(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    updates = req.json(list)  # list of position updates
    user_id = current_user["id"]

    for update in updates:
        await db.execute_run(
            "UPDATE seating_areas SET position_x = ?, position_y = ? WHERE id = ? AND user_id = ?",
            [update.position_x, update.position_y, update.area_id if hasattr(update, 'area_id') else 0, user_id]
        )

    return {"message": "位置更新成功"}


@router.delete("/{conference_id}/areas/{area_id}")
async def delete_area(req, conference_id: str, area_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM seating_assignments WHERE area_id = ? AND user_id = ?",
        [int(area_id), user_id]
    )
    await db.execute_run(
        "DELETE FROM seating_areas WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(area_id), user_id, int(conference_id)]
    )
    return {"message": "区域删除成功"}


@router.post("/{conference_id}/assign")
async def assign_seat(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(SeatAssign)
    user_id = current_user["id"]

    # 检查是否已分配
    existing = await db.execute_one(
        "SELECT id FROM seating_assignments WHERE participant_id = ? AND user_id = ? AND conference_id = ?",
        [data.participant_id, user_id, int(conference_id)]
    )
    if existing:
        await db.execute_run(
            "UPDATE seating_assignments SET area_id = ?, seat_number = ? WHERE participant_id = ? AND user_id = ? AND conference_id = ?",
            [data.area_id, data.seat_number, data.participant_id, user_id, int(conference_id)]
        )
    else:
        await db.execute_run(
            """INSERT INTO seating_assignments (user_id, conference_id, area_id, participant_id, seat_number)
               VALUES (?, ?, ?, ?, ?)""",
            [user_id, int(conference_id), data.area_id, data.participant_id, data.seat_number]
        )

    return {"message": "座位分配成功"}


@router.delete("/{conference_id}/assign/{assignment_id}")
async def remove_seat_assignment(req, conference_id: str, assignment_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM seating_assignments WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(assignment_id), user_id, int(conference_id)]
    )
    return {"message": "座位分配已移除"}


@router.post("/{conference_id}/swap")
async def swap_seats(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(SwapRequest)
    user_id = current_user["id"]

    a1 = await db.execute_one(
        "SELECT * FROM seating_assignments WHERE id = ? AND user_id = ?",
        [data.assignment_id_1, user_id]
    )
    a2 = await db.execute_one(
        "SELECT * FROM seating_assignments WHERE id = ? AND user_id = ?",
        [data.assignment_id_2, user_id]
    )
    if not a1 or not a2:
        raise HTTPException(status_code=404, detail="座位分配不存在")

    a1, a2 = dict(a1), dict(a2)
    await db.execute_run(
        "UPDATE seating_assignments SET area_id = ?, seat_number = ? WHERE id = ? AND user_id = ?",
        [a2["area_id"], a2["seat_number"], a1["id"], user_id]
    )
    await db.execute_run(
        "UPDATE seating_assignments SET area_id = ?, seat_number = ? WHERE id = ? AND user_id = ?",
        [a1["area_id"], a1["seat_number"], a2["id"], user_id]
    )
    return {"message": "座位交换成功"}


@router.post("/{conference_id}/auto-assign")
async def auto_assign_seats(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(AutoAssignRequest)
    user_id = current_user["id"]

    # 获取未分配座位的参会人
    participants = await db.execute(
        """SELECT p.* FROM participants p
           WHERE p.user_id = ? AND p.conference_id = ? AND p.is_attending = 1
           AND p.id NOT IN (SELECT participant_id FROM seating_assignments WHERE user_id = ? AND conference_id = ?)""",
        [user_id, int(conference_id), user_id, int(conference_id)]
    )
    participants_list = [dict(r) for r in participants["results"]]

    # 获取所有区域
    areas = await db.execute(
        "SELECT * FROM seating_areas WHERE user_id = ? AND conference_id = ?",
        [user_id, int(conference_id)]
    )
    areas_list = [dict(r) for r in areas["results"]]

    if not areas_list:
        raise HTTPException(status_code=400, detail="请先创建座位区域")

    # 简单分配逻辑：按顺序分配到区域
    assigned = 0
    area_idx = 0
    seat_num = 1

    for p in participants_list:
        if area_idx >= len(areas_list):
            break

        area = areas_list[area_idx]
        await db.execute_run(
            """INSERT INTO seating_assignments (user_id, conference_id, area_id, participant_id, seat_number)
               VALUES (?, ?, ?, ?, ?)""",
            [user_id, int(conference_id), area["id"], p["id"], str(seat_num)]
        )
        assigned += 1
        seat_num += 1

        # 检查区域容量
        import json
        try:
            config = json.loads(area["config"]) if isinstance(area["config"], str) else area["config"]
            capacity = config.get("capacity", 10)
        except:
            capacity = 10

        if seat_num > capacity:
            area_idx += 1
            seat_num = 1

    return {"assigned": assigned, "total": len(participants_list)}


@router.delete("/{conference_id}/clear")
async def clear_seating(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM seating_assignments WHERE user_id = ? AND conference_id = ?",
        [user_id, int(conference_id)]
    )
    return {"message": "座位安排已清空"}
