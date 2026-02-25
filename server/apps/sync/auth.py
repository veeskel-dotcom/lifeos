from collections import defaultdict
import time

from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import AuthenticationFailed

from .models import DeviceToken

# Rate limiting: block IP after 10 failed attempts in 5 minutes
_failed_attempts = defaultdict(list)
BLOCK_AFTER = 10
BLOCK_WINDOW = 300  # seconds


class DeviceTokenAuthentication(BaseAuthentication):
    """Аутентификация по Bearer token (UUID)."""

    def authenticate(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth.startswith('Bearer '):
            return None

        ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() \
            or request.META.get('REMOTE_ADDR', '')

        # Check rate limit
        now = time.time()
        attempts = _failed_attempts[ip]
        # Clean old attempts
        _failed_attempts[ip] = [t for t in attempts if now - t < BLOCK_WINDOW]
        if len(_failed_attempts[ip]) >= BLOCK_AFTER:
            raise AuthenticationFailed('Too many failed attempts. Try later.')

        token_str = auth[7:].strip()
        try:
            device = DeviceToken.objects.get(token=token_str, is_active=True)
        except (DeviceToken.DoesNotExist, ValueError):
            _failed_attempts[ip].append(now)
            raise AuthenticationFailed('Invalid or inactive device token')

        from django.utils import timezone
        device.last_used = timezone.now()
        device.save(update_fields=['last_used'])

        return (device, token_str)


class IsDeviceAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return request.user is not None and isinstance(request.user, DeviceToken)
