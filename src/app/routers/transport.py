"""
交通管理路由 - D1 版本
"""

from app.asgi_app import Router, HTTPException

from app.core.database import get_db_from_env
from app.core.security import get_current_active_user
from app.schemas.transport import VehicleCreate, VehicleUpdate, TaskCreate, TaskUpdate, TaskStatusUpdate

router = Router(prefix="/api/transport")


# ===== 车辆 CRUD =====

@router.get("/{conference_id}/vehicles")
async def get_vehicles(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    result = await db.execute(
        "SELECT * FROM transport_vehicles WHERE user_id = ? AND conference_id = ? ORDER BY created_at",
        [user_id, int(conference_id)]
    )
    return [dict(r) for r in result["results"]]


@router.post("/{conference_id}/vehicles")
async def create_vehicle(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(VehicleCreate)
    user_id = current_user["id"]

    result = await db.execute_run(
        """INSERT INTO transport_vehicles (user_id, conference_id, plate, model, seats, driver_name, driver_phone)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [user_id, int(conference_id), data.plate, data.model, data.seats,
         data.driver_name, data.driver_phone]
    )

    new_id = result["meta"]["last_row_id"]
    row = await db.execute_one("SELECT * FROM transport_vehicles WHERE id = ?", [new_id])
    return dict(row)


@router.put("/{conference_id}/vehicles/{vehicle_id}")
async def update_vehicle(req, conference_id: str, vehicle_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(VehicleUpdate)
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT id FROM transport_vehicles WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(vehicle_id), user_id, int(conference_id)]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="车辆不存在")

    update_data = {k: v for k, v in vars(data).items() if v is not None}
    set_clauses = []
    params = []
    for key, value in update_data.items():
        set_clauses.append(f"{key} = ?")
        params.append(value)

    if set_clauses:
        params.append(int(vehicle_id))
        params.append(user_id)
        await db.execute_run(
            f"UPDATE transport_vehicles SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?",
            params
        )

    row = await db.execute_one("SELECT * FROM transport_vehicles WHERE id = ?", [int(vehicle_id)])
    return dict(row)


@router.delete("/{conference_id}/vehicles/{vehicle_id}")
async def delete_vehicle(req, conference_id: str, vehicle_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    # 删除相关任务和乘客
    await db.execute_run(
        "DELETE FROM transport_task_passengers WHERE task_id IN (SELECT id FROM transport_tasks WHERE vehicle_id = ? AND user_id = ?)",
        [int(vehicle_id), user_id]
    )
    await db.execute_run(
        "DELETE FROM transport_tasks WHERE vehicle_id = ? AND user_id = ?",
        [int(vehicle_id), user_id]
    )
    await db.execute_run(
        "DELETE FROM transport_vehicles WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(vehicle_id), user_id, int(conference_id)]
    )
    return {"message": "车辆删除成功"}


# ===== 任务 CRUD =====

@router.get("/{conference_id}/tasks")
async def get_tasks(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    result = await db.execute(
        "SELECT * FROM transport_tasks WHERE user_id = ? AND conference_id = ? ORDER BY task_date, start_time",
        [user_id, conference_id]
    )
    tasks = [dict(r) for r in result["results"]]

    for task in tasks:
        passengers = await db.execute(
            """SELECT tp.*, p.name as participant_name, p.company, p.phone_encrypted as phone
               FROM transport_task_passengers tp
               LEFT JOIN participants p ON tp.participant_id = p.id
               WHERE tp.user_id = ? AND tp.task_id = ?""",
            [user_id, task["id"]]
        )
        task["passengers"] = [dict(r) for r in passengers["results"]]

    return tasks


@router.post("/{conference_id}/tasks")
async def create_task(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(TaskCreate)
    user_id = current_user["id"]

    result = await db.execute_run(
        """INSERT INTO transport_tasks (user_id, conference_id, vehicle_id, task_type, task_date,
           start_time, end_time, from_location, from_lat, from_lng,
           to_location, to_lat, to_lng, escort_name, escort_phone, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [user_id, int(conference_id), data.vehicle_id, data.task_type, data.task_date,
         data.start_time, data.end_time, data.from_location, data.from_lat, data.from_lng,
         data.to_location, data.to_lat, data.to_lng, data.escort_name, data.escort_phone, data.note]
    )

    task_id = result["meta"]["last_row_id"]

    # 添加乘客
    for pid in (data.participant_ids or []):
        await db.execute_run(
            "INSERT INTO transport_task_passengers (user_id, task_id, participant_id) VALUES (?, ?, ?)",
            [user_id, task_id, pid]
        )

    row = await db.execute_one("SELECT * FROM transport_tasks WHERE id = ?", [task_id])
    task = dict(row)
    passengers = await db.execute(
        """SELECT tp.*, p.name as participant_name, p.company
           FROM transport_task_passengers tp
           LEFT JOIN participants p ON tp.participant_id = p.id
           WHERE tp.user_id = ? AND tp.task_id = ?""",
        [user_id, task_id]
    )
    task["passengers"] = [dict(r) for r in passengers["results"]]
    return task


@router.put("/{conference_id}/tasks/{task_id}")
async def update_task(req, conference_id: str, task_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(TaskUpdate)
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT id FROM transport_tasks WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(task_id), user_id, int(conference_id)]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="任务不存在")

    update_data = {k: v for k, v in vars(data).items() if v is not None}
    participant_ids = update_data.pop("participant_ids", None)

    set_clauses = []
    params = []
    for key, value in update_data.items():
        set_clauses.append(f"{key} = ?")
        params.append(value)

    if set_clauses:
        params.append(int(task_id))
        params.append(user_id)
        await db.execute_run(
            f"UPDATE transport_tasks SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?",
            params
        )

    # 更新乘客列表
    if participant_ids is not None:
        await db.execute_run(
            "DELETE FROM transport_task_passengers WHERE task_id = ? AND user_id = ?",
            [int(task_id), user_id]
        )
        for pid in participant_ids:
            await db.execute_run(
                "INSERT INTO transport_task_passengers (user_id, task_id, participant_id) VALUES (?, ?, ?)",
                [user_id, int(task_id), pid]
            )

    row = await db.execute_one("SELECT * FROM transport_tasks WHERE id = ?", [int(task_id)])
    task = dict(row)
    passengers = await db.execute(
        """SELECT tp.*, p.name as participant_name, p.company
           FROM transport_task_passengers tp
           LEFT JOIN participants p ON tp.participant_id = p.id
           WHERE tp.user_id = ? AND tp.task_id = ?""",
        [user_id, int(task_id)]
    )
    task["passengers"] = [dict(r) for r in passengers["results"]]
    return task


@router.delete("/{conference_id}/tasks/{task_id}")
async def delete_task(req, conference_id: str, task_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM transport_task_passengers WHERE task_id = ? AND user_id = ?",
        [int(task_id), user_id]
    )
    await db.execute_run(
        "DELETE FROM transport_tasks WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(task_id), user_id, int(conference_id)]
    )
    return {"message": "任务删除成功"}


@router.put("/{conference_id}/tasks/{task_id}/status")
async def update_task_status(req, conference_id: str, task_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(TaskStatusUpdate)
    user_id = current_user["id"]

    await db.execute_run(
        "UPDATE transport_tasks SET status = ? WHERE id = ? AND user_id = ? AND conference_id = ?",
        [data.status, int(task_id), user_id, int(conference_id)]
    )
    return {"message": "任务状态更新成功"}


@router.delete("/{conference_id}/clear")
async def clear_transport(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM transport_task_passengers WHERE user_id = ? AND task_id IN (SELECT id FROM transport_tasks WHERE conference_id = ? AND user_id = ?)",
        [user_id, int(conference_id), user_id]
    )
    await db.execute_run(
        "DELETE FROM transport_tasks WHERE user_id = ? AND conference_id = ?",
        [user_id, int(conference_id)]
    )
    await db.execute_run(
        "DELETE FROM transport_vehicles WHERE user_id = ? AND conference_id = ?",
        [user_id, int(conference_id)]
    )
    return {"message": "交通安排已清空"}
