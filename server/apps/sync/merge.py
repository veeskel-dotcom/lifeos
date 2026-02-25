def apply_delta(data, changes):
    """Применить список изменений к данным ActiveData."""
    for change in changes:
        table = change.get('table')
        op = change.get('op')
        record_id = change.get('record_id')
        record_data = change.get('data')

        if not table:
            continue

        if table not in data:
            data[table] = []

        records = data[table]
        idx = next(
            (i for i, r in enumerate(records) if r.get('id') == record_id),
            None,
        )

        if op in ('add', 'put'):
            if record_data is None:
                continue
            if idx is not None:
                records[idx] = record_data
            else:
                records.append(record_data)

        elif op == 'update':
            if record_data is None:
                continue
            if idx is not None:
                records[idx] = record_data  # полная запись от клиента
            else:
                records.append(record_data)  # upsert

        elif op == 'delete':
            if idx is not None:
                records.pop(idx)

        elif op == 'deleteRange':
            # Не можем точно применить — пропускаем,
            # полный push подхватит
            pass

    return data
