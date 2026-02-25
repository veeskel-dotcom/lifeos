from django import template

register = template.Library()


@register.filter(name='get_field')
def get_field(record, field_name):
    """Get a field value from a dict by key name."""
    if isinstance(record, dict):
        return record.get(field_name, '')
    return getattr(record, field_name, '')
