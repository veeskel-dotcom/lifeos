from django.urls import path
from .views import DashboardView, ModuleListView, htmx_add, htmx_edit_form, htmx_update, htmx_delete

urlpatterns = [
    path('', DashboardView.as_view(), name='dashboard-index'),

    # Module list pages
    path('expenses/', ModuleListView.as_view(), kwargs={'table': 'expenses'}, name='dashboard-expenses'),
    path('incomes/', ModuleListView.as_view(), kwargs={'table': 'incomes'}, name='dashboard-incomes'),
    path('tasks/', ModuleListView.as_view(), kwargs={'table': 'tasks'}, name='dashboard-tasks'),
    path('food/', ModuleListView.as_view(), kwargs={'table': 'food_log'}, name='dashboard-food'),
    path('water/', ModuleListView.as_view(), kwargs={'table': 'water_log'}, name='dashboard-water'),
    path('weight/', ModuleListView.as_view(), kwargs={'table': 'body_weight'}, name='dashboard-weight'),
    path('workouts/', ModuleListView.as_view(), kwargs={'table': 'workouts'}, name='dashboard-workouts'),
    path('portfolio/', ModuleListView.as_view(), kwargs={'table': 'portfolio'}, name='dashboard-portfolio'),

    # HTMX CRUD endpoints
    path('<str:table>/add/', htmx_add, name='htmx-add'),
    path('<str:table>/<int:record_id>/edit/', htmx_edit_form, name='htmx-edit-form'),
    path('<str:table>/<int:record_id>/update/', htmx_update, name='htmx-update'),
    path('<str:table>/<int:record_id>/delete/', htmx_delete, name='htmx-delete'),
]
