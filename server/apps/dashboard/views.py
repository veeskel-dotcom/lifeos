from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView
from django.utils import timezone

from apps.sync.models import ActiveData, SyncSnapshot


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

        last_snapshot = SyncSnapshot.objects.first()  # ordered by -created_at
        ctx['last_sync'] = last_snapshot.created_at if last_snapshot else None
        ctx['snapshots_count'] = SyncSnapshot.objects.count()

        # Module record counts from data
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
