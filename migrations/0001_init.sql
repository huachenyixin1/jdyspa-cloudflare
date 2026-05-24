-- D1 数据库初始化脚本
-- 所有表添加 user_id 字段实现多用户数据隔离
-- D1 基于 SQLite，语法兼容

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 用户表（全局，不需要 user_id）
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    hashed_password TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    is_superuser INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    invitation_code_id INTEGER,
    subscription_start TEXT,
    subscription_end TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    last_active_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 邀请码表（全局，不需要 user_id）
CREATE TABLE IF NOT EXISTS invitation_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    duration_days INTEGER DEFAULT 30,
    status TEXT DEFAULT 'unused',
    created_by INTEGER,
    used_by INTEGER,
    used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 会议表
CREATE TABLE IF NOT EXISTS conferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    purpose TEXT,
    scale INTEGER DEFAULT 50,
    schedule TEXT,
    start_date TEXT,
    end_date TEXT,
    location TEXT,
    has_meal INTEGER DEFAULT 0,
    has_hotel INTEGER DEFAULT 0,
    has_transport INTEGER DEFAULT 0,
    chat_id TEXT,
    status TEXT DEFAULT 'draft',
    year INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 参会人表
CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone_encrypted TEXT,
    email TEXT,
    company TEXT,
    department TEXT,
    position TEXT,
    title TEXT,
    is_present INTEGER DEFAULT 0,
    is_attending INTEGER DEFAULT 1,
    has_meal INTEGER DEFAULT 0,
    has_hotel INTEGER DEFAULT 0,
    has_transport INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE
);

-- 座位区域表
CREATE TABLE IF NOT EXISTS seating_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    area_type TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    scale REAL DEFAULT 1.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE
);

-- 座位分配表
CREATE TABLE IF NOT EXISTS seating_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    area_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    seat_number TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE,
    FOREIGN KEY (area_id) REFERENCES seating_areas(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- 酒店表
CREATE TABLE IF NOT EXISTS hotels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    contact TEXT,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE
);

-- 酒店房间表
CREATE TABLE IF NOT EXISTS hotel_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    hotel_id INTEGER NOT NULL,
    room_number TEXT NOT NULL,
    room_type TEXT DEFAULT 'single',
    floor INTEGER DEFAULT 1,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    status TEXT DEFAULT 'available',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- 住宿分配表
CREATE TABLE IF NOT EXISTS hotel_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    check_in TEXT,
    check_out TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES hotel_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- 餐厅表
CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    capacity INTEGER DEFAULT 0,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE
);

-- 餐桌表
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    table_type TEXT DEFAULT 'round',
    capacity INTEGER DEFAULT 10,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 用餐座位分配表
CREATE TABLE IF NOT EXISTS restaurant_seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    meal_type TEXT DEFAULT 'lunch',
    seat_index INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- 交通车辆表
CREATE TABLE IF NOT EXISTS transport_vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    plate TEXT NOT NULL,
    model TEXT NOT NULL,
    seats INTEGER NOT NULL,
    driver_name TEXT,
    driver_phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE
);

-- 交通任务表
CREATE TABLE IF NOT EXISTS transport_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    conference_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    task_type TEXT NOT NULL,
    task_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    from_location TEXT NOT NULL,
    from_lat REAL,
    from_lng REAL,
    to_location TEXT NOT NULL,
    to_lat REAL,
    to_lng REAL,
    escort_name TEXT,
    escort_phone TEXT,
    note TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES transport_vehicles(id) ON DELETE CASCADE
);

-- 交通任务乘客表
CREATE TABLE IF NOT EXISTS transport_task_passengers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES transport_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    detail TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conferences_user_id ON conferences(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conference_id ON participants(conference_id);
CREATE INDEX IF NOT EXISTS idx_seating_areas_user_id ON seating_areas(user_id);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_user_id ON seating_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_hotels_user_id ON hotels(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_user_id ON hotel_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_assignments_user_id ON hotel_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_user_id ON restaurant_tables(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_seats_user_id ON restaurant_seats(user_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_user_id ON transport_vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_transport_tasks_user_id ON transport_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_transport_task_passengers_user_id ON transport_task_passengers(user_id);

-- 插入默认管理员（密码: admin123）
-- 注意: 实际部署时需要用 bcrypt 生成 hash
INSERT OR IGNORE INTO users (id, username, email, hashed_password, is_active, is_superuser, is_admin)
VALUES (1, 'admin', 'admin@example.com', '$2b$12$placeholder_hash_change_me', 1, 1, 1);
