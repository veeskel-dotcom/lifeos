"""
CRUD-операции над ActiveData.data (JSONB) + создание ServerChange.
Все операции с дашборда проходят через этот модуль.
"""
import time
import copy

from apps.sync.models import ActiveData, ServerChange


def get_active_data():
    """Получить ActiveData (id=1) или None."""
    return ActiveData.objects.filter(id=1).first()


def get_table_records(table_name, sort_key=None, reverse=True):
    """Получить все записи таблицы из ActiveData."""
    active = get_active_data()
    if not active:
        return []
    records = active.data.get(table_name, [])
    if sort_key:
        records = sorted(records, key=lambda r: r.get(sort_key, ''), reverse=reverse)
    return records


def get_record(table_name, record_id):
    """Получить одну запись по id."""
    active = get_active_data()
    if not active:
        return None
    for r in active.data.get(table_name, []):
        if r.get('id') == record_id:
            return r
    return None


def generate_id():
    """Timestamp-based ID. Не пересекается с Dexie auto-increment (++id ~сотни)."""
    return int(time.time() * 1000)


def add_record(table_name, data):
    """Добавить запись. Возвращает запись с id."""
    active = get_active_data()
    if not active:
        return None

    record_id = generate_id()
    data['id'] = record_id

    # Обновить ActiveData
    active_data = copy.deepcopy(active.data)
    if table_name not in active_data:
        active_data[table_name] = []
    active_data[table_name].append(data)
    active.data = active_data
    active.save()

    # Создать ServerChange для pull клиентом
    ServerChange.objects.create(
        table_name=table_name,
        record_id=record_id,
        op='add',
        data=data,
    )

    return data


def update_record(table_name, record_id, data):
    """Обновить запись. Возвращает обновлённую запись."""
    active = get_active_data()
    if not active:
        return None

    active_data = copy.deepcopy(active.data)
    records = active_data.get(table_name, [])
    idx = next((i for i, r in enumerate(records) if r.get('id') == record_id), None)

    if idx is None:
        return None

    # Сохранить id, обновить остальные поля
    data['id'] = record_id
    records[idx] = data
    active.data = active_data
    active.save()

    ServerChange.objects.create(
        table_name=table_name,
        record_id=record_id,
        op='update',
        data=data,
    )

    return data


def delete_record(table_name, record_id):
    """Удалить запись. Возвращает True если найдена и удалена."""
    active = get_active_data()
    if not active:
        return False

    active_data = copy.deepcopy(active.data)
    records = active_data.get(table_name, [])
    idx = next((i for i, r in enumerate(records) if r.get('id') == record_id), None)

    if idx is None:
        return False

    records.pop(idx)
    active.data = active_data
    active.save()

    ServerChange.objects.create(
        table_name=table_name,
        record_id=record_id,
        op='delete',
        data=None,
    )

    return True
