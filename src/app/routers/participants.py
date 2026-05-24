"""
参会人路由 - D1 版本
注意: Excel 导入导出功能在 Workers 中不可用（openpyxl 不支持）
需要在前端处理或使用其他方案
"""

from datetime import datetime
from typing import Optional

from app.asgi_app import Router, HTTPException, StreamingResponse
from urllib.parse import quote

from app.core.database import get_db_from_env
from app.core.security import get_current_active_user
from app.schemas.participant import ParticipantCreate, ParticipantUpdate, BatchDeleteRequest

router = Router(prefix="/participants")


def participant_to_dict(p: dict, decrypt: bool = False) -> dict:
    phone = p.get("phone_encrypted", "") or ""
    return {
        "id": p["id"],
        "conference_id": p["conference_id"],
        "name": p["name"],
        "phone": phone,  # D1 版本暂不解密，需要前端配合
        "email": p.get("email", ""),
        "company": p.get("company", ""),
        "department": p.get("department", ""),
        "position": p.get("position", ""),
        "title": p.get("title", ""),
        "is_present": bool(p.get("is_present", 0)),
        "is_attending": bool(p.get("is_attending", 1)),
        "has_meal": bool(p.get("has_meal", 0)),
        "has_hotel": bool(p.get("has_hotel", 0)),
        "has_transport": bool(p.get("has_transport", 0)),
        "created_at": p.get("created_at"),
        "updated_at": p.get("updated_at"),
    }


@router.get("/template/download")
async def download_template():
    """下载参会人模板 - Workers 中返回 CSV 格式"""
    import io
    output = io.StringIO()
    output.write("姓名,电话,公司,部门,职位,头衔,是否参会,是否用餐,是否住宿,是否接送\n")
    output.write("张三,13800138000,示例公司,技术部,工程师,高级,是,是,是,是\n")
    output.write("李四,13900139000,示例公司,市场部,经理,,是,是,是,是\n")
    content = output.getvalue()

    filename = quote("参会人模板.csv")
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    )


@router.get("/{conference_id}")
async def get_participants(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]
    name = req.query_param("name", "")
    company = req.query_param("company", "")
    department = req.query_param("department", "")
    position = req.query_param("position", "")
    title = req.query_param("title", "")

    query = "SELECT * FROM participants WHERE user_id = ? AND conference_id = ?"
    params = [user_id, int(conference_id)]

    if name:
        query += " AND name LIKE ?"
        params.append(f"%{name}%")
    if company:
        query += " AND company LIKE ?"
        params.append(f"%{company}%")
    if department:
        query += " AND department LIKE ?"
        params.append(f"%{department}%")
    if position:
        query += " AND position LIKE ?"
        params.append(f"%{position}%")
    if title:
        query += " AND title LIKE ?"
        params.append(f"%{title}%")

    result = await db.execute(query, params)
    return [participant_to_dict(dict(r)) for r in result["results"]]


@router.post("/")
async def create_participant(req):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(ParticipantCreate)
    user_id = current_user["id"]

    # 验证会议属于当前用户
    conf = await db.execute_one(
        "SELECT id FROM conferences WHERE id = ? AND user_id = ?",
        [data.conference_id, user_id]
    )
    if not conf:
        raise HTTPException(status_code=404, detail="会议不存在")

    phone_encrypted = data.phone  # D1 版本暂不加密，需要后续适配

    result = await db.execute_run(
        """INSERT INTO participants (user_id, conference_id, name, phone_encrypted, email,
           company, department, position, title, is_attending, has_meal, has_hotel, has_transport)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [user_id, data.conference_id, data.name, phone_encrypted, data.email,
         data.company, data.department, data.position, data.title,
         int(data.is_attending), int(data.has_meal), int(data.has_hotel), int(data.has_transport)]
    )

    new_id = result["meta"]["last_row_id"]
    row = await db.execute_one("SELECT * FROM participants WHERE id = ?", [new_id])
    return participant_to_dict(dict(row))


@router.put("/{participant_id}")
async def update_participant(req, participant_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(ParticipantUpdate)
    user_id = current_user["id"]

    row = await db.execute_one(
        "SELECT * FROM participants WHERE id = ? AND user_id = ?",
        [int(participant_id), user_id]
    )
    if not row:
        raise HTTPException(status_code=404, detail="参会人不存在")

    participant = dict(row)
    update_data = {k: v for k, v in vars(data).items() if v is not None}

    # 处理取消参会/用餐/住宿/接送时清除相关安排
    if "is_attending" in update_data and not update_data["is_attending"] and participant.get("is_attending"):
        await db.execute_run("DELETE FROM seating_assignments WHERE participant_id = ? AND user_id = ?", [int(participant_id), user_id])
        await db.execute_run("DELETE FROM hotel_assignments WHERE participant_id = ? AND user_id = ?", [int(participant_id), user_id])
        await db.execute_run("DELETE FROM restaurant_seats WHERE participant_id = ? AND user_id = ?", [int(participant_id), user_id])
        await db.execute_run("DELETE FROM transport_task_passengers WHERE participant_id = ? AND user_id = ?", [int(participant_id), user_id])

    if "has_meal" in update_data and not update_data["has_meal"] and participant.get("has_meal"):
        await db.execute_run("DELETE FROM restaurant_seats WHERE participant_id = ? AND user_id = ?", [int(participant_id), user_id])

    if "has_hotel" in update_data and not update_data["has_hotel"] and participant.get("has_hotel"):
        await db.execute_run("DELETE FROM hotel_assignments WHERE participant_id = ? AND user_id = ?", [int(participant_id), user_id])

    if "has_transport" in update_data and not update_data["has_transport"] and participant.get("has_transport"):
        await db.execute_run("DELETE FROM transport_task_passengers WHERE participant_id = ? AND user_id = ?", [int(participant_id), user_id])

    set_clauses = []
    params = []
    for key, value in update_data.items():
        if key == "phone":
            set_clauses.append("phone_encrypted = ?")
            params.append(value)  # D1 版本暂不加密
        else:
            # 布尔转整数
            if key in ("is_attending", "has_meal", "has_hotel", "has_transport", "is_present"):
                value = int(value)
            set_clauses.append(f"{key} = ?")
            params.append(value)

    if set_clauses:
        set_clauses.append("updated_at = CURRENT_TIMESTAMP")
        params.append(int(participant_id))
        params.append(user_id)
        await db.execute_run(
            f"UPDATE participants SET {', '.join(set_clauses)} WHERE id = ? AND user_id = ?",
            params
        )

    row = await db.execute_one("SELECT * FROM participants WHERE id = ?", [int(participant_id)])
    return participant_to_dict(dict(row))


@router.delete("/batch")
async def batch_delete_participants(req):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    data = req.json(BatchDeleteRequest)
    user_id = current_user["id"]

    deleted = 0
    for pid in data.ids:
        result = await db.execute_run(
            "DELETE FROM participants WHERE id = ? AND user_id = ?",
            [pid, user_id]
        )
        if result["meta"]["changes"] > 0:
            deleted += 1

    return {"deleted": deleted}


@router.get("/{conference_id}/import")
async def import_participants(req, conference_id: str):
    current_user = await get_current_active_user(req)
    """
    Excel 导入在 Workers 中不可用（openpyxl 不支持 Pyodide）
    此接口需要前端改为 CSV 导入，或通过其他方式处理
    """
    raise HTTPException(
        status_code=501,
        detail="Excel 导入功能在 Cloudflare Workers 中暂不可用，请使用 CSV 格式导入"
    )


@router.get("/{conference_id}/validate")
async def validate_participants(req, conference_id: str):
    db = get_db_from_env(req.env)
    current_user = await get_current_active_user(req)
    user_id = current_user["id"]

    # 获取所有参会人
    result = await db.execute(
        "SELECT * FROM participants WHERE user_id = ? AND conference_id = ?",
        [user_id, int(conference_id)]
    )
    participants = [dict(r) for r in result["results"]]

    # 获取座位分配
    seating_result = await db.execute(
        "SELECT participant_id FROM seating_assignments WHERE user_id = ? AND conference_id = ?",
        [user_id, conference_id]
    )
    seating_ids = {dict(r)["participant_id"] for r in seating_result["results"]}

    # 获取住宿分配
    hotel_result = await db.execute(
        "SELECT participant_id FROM hotel_assignments WHERE user_id = ? AND conference_id = ?",
        [user_id, conference_id]
    )
    hotel_ids = {dict(r)["participant_id"] for r in hotel_result["results"]}

    # 获取用餐分配
    restaurant_result = await db.execute(
        "SELECT participant_id FROM restaurant_seats WHERE user_id = ? AND conference_id = ?",
        [user_id, conference_id]
    )
    restaurant_ids = {dict(r)["participant_id"] for r in restaurant_result["results"]}

    # 获取接送分配
    transport_result = await db.execute(
        "SELECT participant_id FROM transport_task_passengers WHERE user_id = ? AND task_id IN (SELECT id FROM transport_tasks WHERE conference_id = ? AND user_id = ?)",
        [user_id, conference_id, user_id]
    )
    transport_ids = {dict(r)["participant_id"] for r in transport_result["results"]}

    validation_results = []
    for p in participants:
        is_attending = bool(p.get("is_attending", 1))
        has_meal = bool(p.get("has_meal", 0))
        has_hotel = bool(p.get("has_hotel", 0))
        has_transport = bool(p.get("has_transport", 0))

        result_item = {
            "id": p["id"],
            "name": p["name"],
            "is_attending": is_attending,
            "has_meal": has_meal,
            "has_hotel": has_hotel,
            "has_transport": has_transport,
            "attending_valid": True,
            "meal_valid": True,
            "hotel_valid": True,
            "transport_valid": True,
        }

        if is_attending and p["id"] not in seating_ids:
            result_item["attending_valid"] = False
        if has_meal and p["id"] not in restaurant_ids:
            result_item["meal_valid"] = False
        if has_hotel and p["id"] not in hotel_ids:
            result_item["hotel_valid"] = False
        if has_transport and p["id"] not in transport_ids:
            result_item["transport_valid"] = False

        validation_results.append(result_item)

    return validation_results
