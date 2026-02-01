# 电子衣柜数据库信息

## 📊 数据库基本信息

### 数据库位置
- **宿主机路径**: `/root/wardrobe-data/wardrobe.db`
- **容器内路径**: `/app/data/wardrobe.db`
- **数据库类型**: SQLite 3
- **当前大小**: 6.2MB

### 数据库挂载
```bash
# Docker 容器启动时已挂载数据卷
-v /root/wardrobe-data:/app/data
```
这样即使容器重启或删除,数据也不会丢失。

---

## 📋 数据表结构

### wardrobe_items (衣物表)

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| `id` | INTEGER | 主键ID | 自增 |
| `name` | TEXT | 衣物名称 | 必填 |
| `category` | TEXT | 类别 | tops/bottoms/dresses/outerwear/accessories |
| `color` | TEXT | 颜色 | 必填 |
| `brand` | TEXT | 品牌 | 默认:未知品牌 |
| `price` | REAL | 价格 | 默认:0 |
| `seasons` | TEXT | 适用季节 | JSON数组格式 |
| `purchase_date` | TEXT | 购买日期 | YYYY-MM-DD格式 |
| `image` | TEXT | 图片 | Base64或URL |
| `notes` | TEXT | 备注 | 可选 |
| `platform` | TEXT | 购买平台 | 默认:未记录 |
| `created_at` | DATETIME | 创建时间 | 自动生成 |
| `updated_at` | DATETIME | 更新时间 | 自动更新 |

### 索引
- `idx_category` - 类别索引 (提高分类查询性能)
- `idx_color` - 颜色索引 (提高颜色筛选性能)
- `idx_created_at` - 创建时间索引 (提高时间排序性能)

---

## 🔍 查看数据库数据的方法

### 方法1: 通过 API 查询 (推荐)

```bash
# 查看所有衣物
curl http://123.207.40.107:3000/api/items

# 查看统计信息
curl http://123.207.40.107:3000/api/statistics

# 筛选查询 - 查看外套类别
curl "http://123.207.40.107:3000/api/items?category=outerwear"

# 搜索衣物 - 搜索包含"羽绒服"的衣物
curl "http://123.207.40.107:3000/api/items?search=羽绒服"
```

### 方法2: 使用 SQLite 命令行 (服务器上)

```bash
# 进入容器
docker exec -it wardrobe-backend sh

# 查询所有数据
sqlite3 /app/data/wardrobe.db "SELECT * FROM wardrobe_items;"

# 查询数据总数
sqlite3 /app/data/wardrobe.db "SELECT COUNT(*) FROM wardrobe_items;"

# 查询最近添加的10条
sqlite3 /app/data/wardrobe.db "SELECT id, name, brand, price, created_at FROM wardrobe_items ORDER BY created_at DESC LIMIT 10;"

# 按类别统计
sqlite3 /app/data/wardrobe.db "SELECT category, COUNT(*) FROM wardrobe_items GROUP BY category;"

# 按颜色统计
sqlite3 /app/data/wardrobe.db "SELECT color, COUNT(*) FROM wardrobe_items GROUP BY color;"

# 查询价格最贵的衣物
sqlite3 /app/data/wardrobe.db "SELECT name, brand, price FROM wardrobe_items ORDER BY price DESC LIMIT 5;"

# 退出容器
exit
```

### 方法3: 直接在宿主机查询

```bash
# 安装 sqlite3 (如果未安装)
yum install sqlite -y  # CentOS/RHEL
# 或
apt install sqlite3 -y  # Ubuntu/Debian

# 查询数据
sqlite3 /root/wardrobe-data/wardrobe.db "SELECT * FROM wardrobe_items;"
```

### 方法4: 使用图形化工具 (本地)

1. 从服务器下载数据库文件:
```bash
scp root@123.207.40.107:/root/wardrobe-data/wardrobe.db ./wardrobe.db
```

2. 使用工具打开:
   - **DB Browser for SQLite** (免费,跨平台)
   - **DBeaver** (功能强大)
   - **SQLiteStudio** (轻量级)
   - **Navicat** (商业软件)

---

## 📊 常用 SQL 查询语句

### 基础查询
```sql
-- 查看所有衣物
SELECT * FROM wardrobe_items;

-- 查看特定类别
SELECT * FROM wardrobe_items WHERE category = 'outerwear';

-- 搜索衣物名称
SELECT * FROM wardrobe_items WHERE name LIKE '%羽绒服%';

-- 查询特定价格范围
SELECT * FROM wardrobe_items WHERE price BETWEEN 100 AND 500;
```

### 统计查询
```sql
-- 总数统计
SELECT COUNT(*) as total FROM wardrobe_items;

-- 类别分布
SELECT category, COUNT(*) as count FROM wardrobe_items GROUP BY category;

-- 颜色分布
SELECT color, COUNT(*) as count FROM wardrobe_items GROUP BY color;

-- 平均价格
SELECT AVG(price) as avg_price FROM wardrobe_items;

-- 总价值
SELECT SUM(price) as total_value FROM wardrobe_items;

-- 最贵的10件衣物
SELECT name, brand, price FROM wardrobe_items ORDER BY price DESC LIMIT 10;
```

### 时间查询
```sql
-- 本月添加的衣物
SELECT * FROM wardrobe_items 
WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now');

-- 最近7天添加的衣物
SELECT * FROM wardrobe_items 
WHERE created_at >= datetime('now', '-7 days');

-- 按月统计添加数量
SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
FROM wardrobe_items 
GROUP BY month 
ORDER BY month DESC;
```

---

## 💾 数据备份与恢复

### 备份数据库

```bash
# 方法1: 直接复制文件
cp /root/wardrobe-data/wardrobe.db /root/wardrobe-backup-$(date +%Y%m%d-%H%M%S).db

# 方法2: 使用 SQLite 导出
docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db .dump > wardrobe-backup.sql

# 方法3: 定期自动备份 (添加到 crontab)
# 每天凌晨3点备份
0 3 * * * cp /root/wardrobe-data/wardrobe.db /root/backups/wardrobe-$(date +\%Y\%m\%d).db
```

### 恢复数据库

```bash
# 从备份文件恢复
docker stop wardrobe-backend
cp /root/wardrobe-backup-20260201.db /root/wardrobe-data/wardrobe.db
docker start wardrobe-backend

# 从 SQL 文件恢复
docker exec -i wardrobe-backend sqlite3 /app/data/wardrobe.db < wardrobe-backup.sql
```

---

## 🔧 数据库维护

### 优化数据库
```bash
# 清理和优化数据库文件
docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "VACUUM;"

# 分析和优化查询
docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "ANALYZE;"
```

### 检查数据库完整性
```bash
docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "PRAGMA integrity_check;"
```

### 查看数据库信息
```bash
# 数据库大小
du -sh /root/wardrobe-data/wardrobe.db

# 数据库页面大小
docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "PRAGMA page_size;"

# 数据库页面数量
docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "PRAGMA page_count;"
```

---

## 🛠️ 快速操作脚本

创建一个管理脚本 `/root/manage-wardrobe-db.sh`:

```bash
#!/bin/bash

echo "电子衣柜数据库管理工具"
echo "======================="
echo ""
echo "1. 查看数据总数"
echo "2. 查看最近添加的数据"
echo "3. 按类别统计"
echo "4. 备份数据库"
echo "5. 查看数据库大小"
echo "6. 优化数据库"
echo "0. 退出"
echo ""
read -p "请选择操作 [0-6]: " choice

case $choice in
    1)
        echo "数据总数:"
        docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "SELECT COUNT(*) FROM wardrobe_items;"
        ;;
    2)
        echo "最近添加的10条数据:"
        docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "SELECT id, name, brand, price, created_at FROM wardrobe_items ORDER BY created_at DESC LIMIT 10;"
        ;;
    3)
        echo "按类别统计:"
        docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "SELECT category, COUNT(*) as count FROM wardrobe_items GROUP BY category;"
        ;;
    4)
        backup_file="/root/wardrobe-backup-$(date +%Y%m%d-%H%M%S).db"
        cp /root/wardrobe-data/wardrobe.db "$backup_file"
        echo "备份完成: $backup_file"
        ;;
    5)
        echo "数据库大小:"
        du -sh /root/wardrobe-data/wardrobe.db
        ;;
    6)
        echo "优化数据库..."
        docker exec wardrobe-backend sqlite3 /app/data/wardrobe.db "VACUUM;"
        echo "优化完成!"
        ;;
    0)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效选择"
        ;;
esac
```

---

## 📱 Web 界面访问

最简单的方式是直接访问前端网页:
- **主页**: http://123.207.40.107:3000
- **统计页面**: 点击左侧"衣柜统计"菜单

---

## 🔐 安全建议

1. **定期备份**: 建议每天自动备份数据库
2. **限制访问**: 如有需要,可配置防火墙限制访问IP
3. **数据加密**: 敏感数据建议加密存储
4. **用户认证**: 考虑添加登录功能保护数据

---

## 📞 技术支持

如需修改数据库结构或添加新功能,可以:
1. 修改 `server.js` 中的数据库初始化代码
2. 重新构建并部署容器
3. 数据会自动迁移(如果字段兼容)
