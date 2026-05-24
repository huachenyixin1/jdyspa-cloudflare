"""
餐厅/用餐管理路由 - D1 版本
"""

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import get_db, D1Database
from app.core.security import get_current_active_user
from app.schemas.restaurant import (
    RestaurantCreate, RestaurantUpdate,
    TableCreate, TableBatchCreate, TableUpdate,
    SeatAssignCreate, SeatAssignDelete, SwapAssignRequest, MoveAssignRequest
)

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


# ===== 餐厅 CRUD =====

@router.get("/{conference_id}")
async def get_restaurants(
    conference_id: int,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    result = await db.execute(
        "SELECT * FROM restaurants WHERE user_id = ? AND conference_id = ? ORDER BY created_at",
        [user_id, conference_id]
    )
    restaurants = [dict(r) for r in result["results"]]

    for restaurant in restaurants:
        tables = await db.execute(
            "SELECT * FROM restaurant_tables WHERE user_id = ? AND restaurant_id = ? ORDER BY position_y, position_x",
            [user_id, restaurant["id"]]
        )
        restaurant["tables"] = [dict(r) for r in tables["results"]]

        for table in restaurant["tables"]:
            seats = await db.execute(
                """SELECT rs.*, p.name as participant_name, p.company, p.department, p.position, p.title
                   FROM restaurant_seats rs
                   LEFT JOIN participants p ON rs.participant_id = p.id
                   WHERE rs.user_id = ? AND rs.table_id = ?""",
                [user_id, table["id"]]
            )
            table["seats"] = [dict(r) for r in seats["results"]]

    return restaurants


@router.post("/{conference_id}")
async def create_restaurant(
    conference_id: int,
    data: RestaurantCreate,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    result = await db.execute_run(
        """INSERT INTO restaurants (user_id, conference_id, name, address, capacity, note)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [user_id, conference_id, data.name, data.address, data.capacity, data.note]
    )

    new_id = result["meta"]["last_row_id"]
    row = await db.execute_one("SELECT * FROM restaurants WHERE id = ?", [new_id])
    restaurant = dict(row)
    restaurant["tables"] = []
    return restaurant


@router.put("/{conference_id}/{restaurant_id}")
async def update_restaurant(
    conference_id: int,
    restaurant_id: int,
    data: RestaurantUpdate,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT id FROM restaurants WHERE id = ? AND user_id = ? AND conference_id = ?",
        [restaurant_id, user_id, conference_id]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="餐厅不存在")

    update_data = {k: v for k, v in vars(data).items() if v is not None}
    set_clauses = []
    params = []
    for key, value in update_data.items():
        set_clauses.append(f"{key} = ?")
        params.append(value)

    if set_clauses:
        params.append(restaurant_id)
        params.append(user_id)
        await db.execute_run(
            f"UPDATE restaurants SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?",
            params
        )

    row = await db.execute_one("SELECT * FROM restaurants WHERE id = ?", [restaurant_id])
    return dict(row)


@router.delete("/{conference_id}/{restaurant_id}")
async def delete_restaurant(
    conference_id: int,
    restaurant_id: int,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    # 删除相关数据
    await db.execute_run(
        "DELETE FROM restaurant_seats WHERE table_id IN (SELECT id FROM restaurant_tables WHERE restaurant_id = ? AND user_id = ?)",
        [restaurant_id, user_id]
    )
    await db.execute_run(
        "DELETE FROM restaurant_tables WHERE restaurant_id = ? AND user_id = ?",
        [restaurant_id, user_id]
    )
    await db.execute_run(
        "DELETE FROM restaurants WHERE id = ? AND user_id = ? AND conference_id = ?",
        [restaurant_id, user_id, conference_id]
    )
    return {"message": "餐厅删除成功"}


# ===== 餐桌 CRUD =====

@router.post("/{conference_id}/{restaurant_id}/tables")
async def create_table(
    conference_id: int,
    restaurant_id: int,
    data: TableCreate,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    result = await db.execute_run(
        """INSERT INTO restaurant_tables (user_id, conference_id, restaurant_id, name, table_type, capacity, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [user_id, conference_id, restaurant_id, data.name, data.table_type,
         data.capacity, data.position_x, data.position_y]
    )

    new_id = result["meta"]["last_row_id"]
    row = await db.execute_one("SELECT * FROM restaurant_tables WHERE id = ?", [new_id])
    table = dict(row)
    table["seats"] = []
    return table


@router.post("/{conference_id}/{restaurant_id}/tables/batch")
async def batch_create_tables(
    conference_id: int,
    restaurant_id: int,
    data: TableBatchCreate,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    created = []
    for i in range(data.quantity):
        name = f"{data.name_prefix}{i + 1}"
        result = await db.execute_run(
            """INSERT INTO restaurant_tables (user_id, conference_id, restaurant_id, name, table_type, capacity, position_x, position_y)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            [user_id, conference_id, restaurant_id, name, data.table_type,
             data.capacity_per_table, i * 100, 0]
        )
        new_id = result["meta"]["last_row_id"]
        row = await db.execute_one("SELECT * FROM restaurant_tables WHERE id = ?", [new_id])
        table = dict(row)
        table["seats"] = []
        created.append(table)

    return created


@router.put("/{conference_id}/tables/{table_id}")
async def update_table(
    conference_id: int,
    table_id: int,
    data: TableUpdate,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    existing = await db.execute_one(
        "SELECT id FROM restaurant_tables WHERE id = ? AND user_id = ?",
        [table_id, user_id]
    )
    if not existing:
        raise HTTPException(status_code=404, detail="餐桌不存在")

    update_data = {k: v for k, v in vars(data).items() if v is not None}
    set_clauses = []
    params = []
    for key, value in update_data.items():
        set_clauses.append(f"{key} = ?")
        params.append(value)

    if set_clauses:
        params.append(table_id)
        params.append(user_id)
        await db.execute_run(
            f"UPDATE restaurant_tables SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?",
            params
        )

    row = await db.execute_one("SELECT * FROM restaurant_tables WHERE id = ?", [table_id])
    return dict(row)


@router.delete("/{conference_id}/tables/{table_id}")
async def delete_table(
    conference_id: int,
    table_id: int,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM restaurant_seats WHERE table_id = ? AND user_id = ?",
        [table_id, user_id]
    )
    await db.execute_run(
        "DELETE FROM restaurant_tables WHERE id = ? AND user_id = ?",
        [table_id, user_id]
    )
    return {"message": "餐桌删除成功"}


# ===== 用餐座位分配 =====

@router.post("/{conference_id}/assign")
async def assign_seat(
    conference_id: int,
    data: SeatAssignCreate,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    # 检查是否已分配该餐次
    existing = await db.execute_one(
        "SELECT id FROM restaurant_seats WHERE participant_id = ? AND meal_type = ? AND user_id = ? AND conference_id = ?",
        [data.participant_id, data.meal_type, user_id, conference_id]
    )
    if existing:
        await db.execute_run(
            "UPDATE restaurant_seats SET table_id = ?, seat_index = ? WHERE participant_id = ? AND meal_type = ? AND user_id = ? AND conference_id = ?",
            [data.table_id, data.seat_index, data.participant_id, data.meal_type, user_id, conference_id]
        )
    else:
        await db.execute_run(
            """INSERT INTO restaurant_seats (user_id, conference_id, table_id, participant_id, meal_type, seat_index)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [user_id, conference_id, data.table_id, data.participant_id, data.meal_type, data.seat_index]
        )

    return {"message": "用餐座位分配成功"}


@router.delete("/{conference_id}/unassign")
async def unassign_seat(
    conference_id: int,
    data: SeatAssignDelete,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM restaurant_seats WHERE participant_id = ? AND meal_type = ? AND user_id = ? AND conference_id = ?",
        [data.participant_id, data.meal_type, user_id, conference_id]
    )
    return {"message": "用餐座位分配已移除"}


@router.post("/{conference_id}/swap")
async def swap_seats(
    conference_id: int,
    data: SwapAssignRequest,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    s1 = await db.execute_one(
        "SELECT * FROM restaurant_seats WHERE id = ? AND user_id = ?",
        [data.source_assignment_id, user_id]
    )
    s2 = await db.execute_one(
        "SELECT * FROM restaurant_seats WHERE id = ? AND user_id = ?",
        [data.target_assignment_id, user_id]
    )
    if not s1 or not s2:
        raise HTTPException(status_code=404, detail="座位分配不存在")

    s1, s2 = dict(s1), dict(s2)
    await db.execute_run(
        "UPDATE restaurant_seats SET table_id = ?, seat_index = ? WHERE id = ? AND user_id = ?",
        [s2["table_id"], s2["seat_index"], s1["id"], user_id]
    )
    await db.execute_run(
        "UPDATE restaurant_seats SET table_id = ?, seat_index = ? WHERE id = ? AND user_id = ?",
        [s1["table_id"], s1["seat_index"], s2["id"], user_id]
    )
    return {"message": "座位交换成功"}


@router.post("/{conference_id}/move")
async def move_seat(
    conference_id: int,
    data: MoveAssignRequest,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    await db.execute_run(
        "UPDATE restaurant_seats SET table_id = ?, seat_index = ? WHERE id = ? AND user_id = ?",
        [data.target_table_id, data.target_seat_index, data.assignment_id, user_id]
    )
    return {"message": "座位移动成功"}


@router.delete("/{conference_id}/clear")
async def clear_restaurant_assignments(
    conference_id: int,
    current_user: dict = Depends(get_current_active_user),
    db: D1Database = Depends(get_db),
):
    user_id = current_user["id"]

    await db.execute_run(
        "DELETE FROM restaurant_seats WHERE user_id = ? AND conference_id = ?",
        [user_id, conference_id]
    )
    return {"message": "用餐安排已清空"}
