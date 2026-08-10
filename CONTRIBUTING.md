# 如何擴寫這個世界

## 加一場戲

1. 編輯 `world/world.json` → `episode.scenes` 新增一筆
2. 同步更新 `world/SCRIPT.md`
3. PR 標題建議：`feat(ep01): 新增 XXX 場`

## 加地點

1. `locations` 陣列加物件（id / name / mood / desc / backdrop）
2. 更新 `LOCATIONS.md`

## 加角色

1. `characters` 陣列
2. 更新 `CHARACTERS.md`

## 第二集

建議新增：

```json
"episodes": [ { "id": "ep01", ... }, { "id": "ep02", "title": "第二集：老街傳聞", ... } ]
```

（目前單集存在 `episode` 欄位，擴多集時可重構為陣列。）
