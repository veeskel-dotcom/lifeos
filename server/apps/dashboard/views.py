from html import escape as html_escape

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.views.decorators.http import require_http_methods

from apps.sync.models import ActiveData, SyncSnapshot
from .crud import get_table_records, get_record, add_record, update_record, delete_record


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'dashboard/index.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        active = ActiveData.objects.first()

        if not active:
            ctx['has_data'] = False
            return ctx

        ctx['has_data'] = True
        ctx['summary'] = active.summary or {}
        ctx['schema_version'] = active.schema_version
        ctx['updated_at'] = active.updated_at

        last_snapshot = SyncSnapshot.objects.first()
        ctx['last_sync'] = last_snapshot.created_at if last_snapshot else None
        ctx['snapshots_count'] = SyncSnapshot.objects.count()

        data = active.data or {}
        modules = {
            'finance': ['expenses', 'incomes', 'accounts', 'credits', 'subscriptions', 'budget_categories'],
            'tasks': ['tasks', 'calendar_events'],
            'nutrition': ['food_log', 'water_log', 'shopping_list'],
            'sport': ['workouts', 'exercises', 'workout_templates'],
            'invest': ['portfolio', 'transactions', 'dividends'],
            'health': ['sleep_log', 'body_weight', 'body_measurements'],
        }
        ctx['modules'] = {}
        for name, tables in modules.items():
            count = sum(len(data.get(t, [])) for t in tables)
            ctx['modules'][name] = {'tables': tables, 'count': count}

        return ctx


# ─── Module views ─────────────────────────────────────

# Config: table_name → {template, sort_key, fields, label}
MODULE_CONFIG = {
    'expenses': {
        'label': 'Expenses',
        'sort_key': 'date',
        'fields': ['date', 'amount', 'category_id', 'account_id', 'description'],
        'columns': ['Date', 'Amount', 'Category', 'Account', 'Description'],
    },
    'incomes': {
        'label': 'Incomes',
        'sort_key': 'date',
        'fields': ['date', 'amount', 'category_id', 'account_id', 'description'],
        'columns': ['Date', 'Amount', 'Category', 'Account', 'Description'],
    },
    'tasks': {
        'label': 'Tasks',
        'sort_key': 'created_at',
        'fields': ['title', 'status', 'deadline', 'priority', 'description'],
        'columns': ['Title', 'Status', 'Deadline', 'Priority', 'Description'],
    },
    'food_log': {
        'label': 'Food',
        'sort_key': 'date',
        'fields': ['date', 'meal_type', 'product_name', 'calories', 'protein', 'fat', 'carbs', 'weight_g'],
        'columns': ['Date', 'Meal', 'Product', 'Kcal', 'Protein', 'Fat', 'Carbs', 'Weight(g)'],
    },
    'water_log': {
        'label': 'Water',
        'sort_key': 'date',
        'fields': ['date', 'amount_ml'],
        'columns': ['Date', 'Amount (ml)'],
    },
    'body_weight': {
        'label': 'Weight',
        'sort_key': 'date',
        'fields': ['date', 'weight'],
        'columns': ['Date', 'Weight (kg)'],
    },
    'workouts': {
        'label': 'Workouts',
        'sort_key': 'date',
        'readonly': True,
        'fields': ['date', 'template_name', 'duration_min'],
        'columns': ['Date', 'Template', 'Duration (min)'],
    },
    'portfolio': {
        'label': 'Portfolio',
        'sort_key': 'ticker',
        'readonly': True,
        'fields': ['ticker', 'name', 'quantity', 'avg_price', 'currency'],
        'columns': ['Ticker', 'Name', 'Qty', 'Avg Price', 'Currency'],
    },
}


class ModuleListView(LoginRequiredMixin, TemplateView):
    template_name = 'dashboard/module_list.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        table = self.kwargs['table']
        config = MODULE_CONFIG.get(table, {})
        ctx['table'] = table
        ctx['config'] = config
        ctx['records'] = get_table_records(table, sort_key=config.get('sort_key'))
        ctx['fields'] = config.get('fields', [])
        ctx['columns'] = config.get('columns', [])
        ctx['readonly'] = config.get('readonly', False)
        ctx['label'] = config.get('label', table)
        return ctx


@login_required
@require_http_methods(["POST"])
def htmx_add(request, table):
    """POST: добавить запись через HTMX."""
    config = MODULE_CONFIG.get(table)
    if not config or config.get('readonly'):
        return HttpResponse('Read-only', status=403)

    data = {}
    for field in config['fields']:
        val = request.POST.get(field, '')
        # Числовые поля
        if field in ('amount', 'calories', 'protein', 'fat', 'carbs', 'weight_g', 'weight', 'amount_ml', 'priority'):
            try:
                data[field] = float(val) if val else 0
            except ValueError:
                data[field] = 0
        else:
            data[field] = val

    record = add_record(table, data)
    if not record:
        return HttpResponse('<div class="text-red-500 text-sm p-2">No data synced yet</div>')

    # Return updated table body
    records = get_table_records(table, sort_key=config.get('sort_key'))
    return _render_table_body(records, config['fields'], table, config.get('readonly', False))


@login_required
def htmx_edit_form(request, table, record_id):
    """GET: показать inline edit form."""
    config = MODULE_CONFIG.get(table, {})
    record = get_record(table, record_id)
    if not record:
        return HttpResponse('Not found', status=404)

    fields = config.get('fields', [])
    cells = []
    for f in fields:
        val = html_escape(str(record.get(f, '')), quote=True)
        input_type = 'number' if f in ('amount', 'calories', 'protein', 'fat', 'carbs', 'weight_g', 'weight', 'amount_ml', 'priority') else ('date' if f == 'date' or f == 'deadline' else 'text')
        step = ' step="0.01"' if input_type == 'number' else ''
        cells.append(
            f'<td class="px-3 py-1"><input type="{input_type}" name="{f}" value="{val}"{step} '
            f'class="w-full border rounded px-2 py-1 text-sm"></td>'
        )

    html = (
        f'<tr id="row-{record_id}" class="bg-yellow-50">'
        + ''.join(cells)
        + f'<td class="px-3 py-1 whitespace-nowrap">'
        f'<button hx-put="/dashboard/{table}/{record_id}/update/" hx-target="#table-body" '
        f'hx-include="closest tr" hx-swap="innerHTML" '
        f'class="text-green-600 hover:text-green-800 text-sm font-medium mr-2">Save</button>'
        f'<button hx-get="/dashboard/{table}/" hx-target="#table-body" hx-swap="innerHTML" '
        f'hx-select="#table-body > *" '
        f'class="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>'
        f'</td></tr>'
    )
    return HttpResponse(html)


@login_required
@require_http_methods(["PUT"])
def htmx_update(request, table, record_id):
    """PUT: обновить запись через HTMX."""
    config = MODULE_CONFIG.get(table)
    if not config or config.get('readonly'):
        return HttpResponse('Read-only', status=403)

    # Собрать данные из PUT body (HTMX отправляет как form)
    from django.http import QueryDict
    if request.content_type == 'application/x-www-form-urlencoded':
        params = QueryDict(request.body)
    else:
        params = request.POST

    # Получить текущую запись для merge
    current = get_record(table, record_id)
    if not current:
        return HttpResponse('Not found', status=404)

    data = dict(current)  # сохранить все поля
    for field in config['fields']:
        val = params.get(field, '')
        if field in ('amount', 'calories', 'protein', 'fat', 'carbs', 'weight_g', 'weight', 'amount_ml', 'priority'):
            try:
                data[field] = float(val) if val else 0
            except ValueError:
                data[field] = 0
        else:
            data[field] = val

    update_record(table, record_id, data)
    records = get_table_records(table, sort_key=config.get('sort_key'))
    return _render_table_body(records, config['fields'], table, config.get('readonly', False))


@login_required
@require_http_methods(["DELETE"])
def htmx_delete(request, table, record_id):
    """DELETE: удалить запись через HTMX."""
    config = MODULE_CONFIG.get(table)
    if not config or config.get('readonly'):
        return HttpResponse('Read-only', status=403)

    delete_record(table, record_id)
    records = get_table_records(table, sort_key=config.get('sort_key'))
    return _render_table_body(records, config['fields'], table, False)


def _render_table_body(records, fields, table, readonly):
    """Вернуть HTML tbody с записями."""
    if not records:
        colspan = len(fields) + (0 if readonly else 1)
        return HttpResponse(
            f'<tr><td colspan="{colspan}" class="text-center text-gray-400 py-8">No records</td></tr>'
        )

    rows = []
    for r in records:
        rid = r.get('id', '')
        cells = ''.join(
            f'<td class="px-3 py-2 text-sm text-gray-700">{html_escape(str(r.get(f, "")))}</td>'
            for f in fields
        )
        if not readonly:
            actions = (
                f'<td class="px-3 py-2 whitespace-nowrap">'
                f'<button hx-get="/dashboard/{table}/{rid}/edit/" hx-target="#row-{rid}" '
                f'hx-swap="outerHTML" class="text-blue-600 hover:text-blue-800 text-sm mr-2">Edit</button>'
                f'<button hx-delete="/dashboard/{table}/{rid}/delete/" hx-target="#table-body" '
                f'hx-swap="innerHTML" hx-confirm="Delete this record?" '
                f'class="text-red-500 hover:text-red-700 text-sm">Del</button>'
                f'</td>'
            )
        else:
            actions = ''
        rows.append(f'<tr id="row-{rid}" class="hover:bg-gray-50 border-b border-gray-100">{cells}{actions}</tr>')

    return HttpResponse('\n'.join(rows))
