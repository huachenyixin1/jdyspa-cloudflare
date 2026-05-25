"""
酒店管理路由 - D1 版本
"""

from app.asgi_app import Router, HTTPException

from app.core.database import get_db_from_env
from app.core.security import get_current_active_user
from app.schemas.hotel import HotelCreate, HotelUpdate, RoomCreate, RoomBatchCreate, RoomUpdate, AssignmentCreate

router = Router(prefix="/api/hotels")


# ===== 酒店 CRUD =====

@router.get("/{conference_id}")
async def get_hotels(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    result = await db.execute(
        "SELECT * FROM hotels WHERE user_id = ? AND conference_id = ? ORDER BY created_at",
        [user_id, int(conference_id)]
    )
    hotels = [dict(r) for r in result["results"]]

    for hotel in hotels:
        rooms = await db.execute(
            "SELECT * FROM hotel_rooms WHERE user_id = ? AND hotel_id = ? ORDER BY floor, room_number",
            [user_id, hotel["id"]]
        )
        hotel["rooms"] = [dict(r) for r in rooms["results"]]

        for room in hotel["rooms"]:
            assignment = await db.execute(
                """SELECT ha.*, p.name as participant_name, p.company, p.phone_encrypted as phone
                   FROM hotel_assignments ha
                   LEFT JOIN participants p ON ha.participant_id = p.id
                   WHERE ha.user_id = ? AND ha.room_id = ?""",
                [user_id, room["id"]]
            )
            room["assignments"] = [dict(r) for r in assignment["results"]]

    return hotels


@router.post("/{conference_id}")
async def create_hotel(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(HotelCreate)
    user_id = current_user["id"]

    result = await db.execute_run(
        """INSERT INTO hotels (user_id, conference_id, name, location, contact, note)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [user_id, int(conference_id), data.name, data.location, data.contact, data.note]
    )

    new_id = result["meta"]["last_row_id"]
    row = await db.execute_one("SELECT * FROM hotels WHERE id = ?", [new_id])
    hotel = dict(row)
    hotel["rooms"] = []
    return hotel


@router.put("/{conference_id}/{hotel_id}")
async def update_hotel(req, conference_id: str, hotel_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(HotelUpdate)
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT id FROM hotels WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(hotel_id), user_id, int(conference_id)]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="酒店不存在")

    update_data = {k: v for k, v in vars(data).items() if v is not None}
    set_clauses = []
    params = []
    for key, value in update_data.items():
        set_clauses.append(f"{key} = ?")
        params.append(value)

    if set_clauses:
        params.append(int(hotel_id))
        params.append(user_id)
        await db.execute_run(
            f"UPDATE hotels SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?",
            params
        )

    row = await db.execute_one("SELECT * FROM hotels WHERE id = ?", [int(hotel_id)])
    return dict(row)


@router.delete("/{conference_id}/{hotel_id}")
async def delete_hotel(req, conference_id: str, hotel_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    # 删除相关分配
    await db.execute_run(
        "DELETE FROM hotel_assignments WHERE room_id IN (SELECT id FROM hotel_rooms WHERE hotel_id = ? AND user_id = ?)",
        [int(hotel_id), user_id]
    )
    await db.execute_run(
        "DELETE FROM hotel_rooms WHERE hotel_id = ? AND user_id = ?",
        [int(hotel_id), user_id]
    )
    await db.execute_run(
        "DELETE FROM hotels WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(hotel_id), user_id, int(conference_id)]
    )
    return {"message": "酒店删除成功"}


# ===== 房间 CRUD =====

@router.post("/{conference_id}/{hotel_id}/rooms")
async def create_room(req, conference_id: str, hotel_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(RoomCreate)
    user_id = current_user["id"]

    result = await db.execute_run(
        """INSERT INTO hotel_rooms (user_id, conference_id, hotel_id, room_number, room_type, floor, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [user_id, int(conference_id), int(hotel_id), data.room_number, data.room_type,
         data.floor, data.position_x, data.position_y]
    )

    new_id = result["meta"]["last_row_id"]
    row = await db.execute_one("SELECT * FROM hotel_rooms WHERE id = ?", [new_id])
    room = dict(row)
    room["assignments"] = []
    return room


@router.post("/{conference_id}/{hotel_id}/rooms/batch")
async def batch_create_rooms(req, conference_id: str, hotel_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(RoomBatchCreate)
    user_id = current_user["id"]

    created = []
    for i, room_data in enumerate(data.rooms):
        result = await db.execute_run(
            """INSERT INTO hotel_rooms (user_id, conference_id, hotel_id, room_number, room_type, floor, position_x, position_y)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            [user_id, int(conference_id), int(hotel_id),
             room_data.get("room_number", f"{i+1}"),
             room_data.get("room_type", "single"),
             room_data.get("floor", 1),
             room_data.get("position_x", 0),
             room_data.get("position_y", 0)]
        )
        new_id = result["meta"]["last_row_id"]
        row = await db.execute_one("SELECT * FROM hotel_rooms WHERE id = ?", [new_id])
        created.append(dict(row))

    return created


@router.put("/{conference_id}/rooms/{room_id}")
async def update_room(req, conference_id: str, room_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(RoomUpdate)
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT id FROM hotel_rooms WHERE id = ? AND user_id = ?",
        [int(room_id), user_id]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="房间不存在")

    update_data = {k: v for k, v in vars(data).items() if v is not None}
    set_clauses = []
    params = []
    for key, value in update_data.items():
        set_clauses.append(f"{key} = ?")
        params.append(value)

    if set_clauses:
        params.append(int(room_id))
        params.append(user_id)
        await db.execute_run(
            f"UPDATE hotel_rooms SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?",
            params
        )

    row = await db.execute_one("SELECT * FROM hotel_rooms WHERE id = ?", [int(room_id)])
    return dict(row)


@router.delete("/{conference_id}/rooms/{room_id}")
async def delete_room(req, conference_id: str, room_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM hotel_assignments WHERE room_id = ? AND user_id = ?",
        [int(room_id), user_id]
    )
    await db.execute_run(
        "DELETE FROM hotel_rooms WHERE id = ? AND user_id = ?",
        [int(room_id), user_id]
    )
    return {"message": "房间删除成功"}


# ===== 住宿分配 =====

@router.post("/{conference_id}/assign")
async def assign_hotel(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(AssignmentCreate)
    user_id = current_user["id"]

    # 检查是否已分配
    existing = await db.execute_one(
        "SELECT id FROM hotel_assignments WHERE participant_id = ? AND user_id = ? AND conference_id = ?",
        [data.participant_id, user_id, int(conference_id)]
    )
    if existing:
        await db.execute_run(
            "UPDATE hotel_assignments SET room_id = ?, check_in = ?, check_out = ? WHERE participant_id = ? AND user_id = ? AND conference_id = ?",
            [data.room_id, data.check_in, data.check_out, data.participant_id, user_id, int(conference_id)]
        )
    else:
        await db.execute_run(
            """INSERT INTO hotel_assignments (user_id, conference_id, room_id, participant_id, check_in, check_out)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [user_id, int(conference_id), data.room_id, data.participant_id, data.check_in, data.check_out]
        )

    return {"message": "住宿分配成功"}


@router.delete("/{conference_id}/assign/{assignment_id}")
async def remove_hotel_assignment(req, conference_id: str, assignment_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM hotel_assignments WHERE id = ? AND user_id = ? AND conference_id = ?",
        [int(assignment_id), user_id, int(conference_id)]
    )
    return {"message": "住宿分配已移除"}


@router.delete("/{conference_id}/clear")
async def clear_hotel_assignments(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM hotel_assignments WHERE user_id = ? AND conference_id = ?",
        [user_id, int(conference_id)]
    )
    return {"message": "住宿安排已清空"}
