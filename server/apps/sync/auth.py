from collections import defaultdict
import time

from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import AuthenticationFailed

from .models import DeviceToken

# Rate limiting: block IP after 10 failed attempts in 5 minutes
# Note: in-memory dict resets per gunicorn worker — acceptable for MVP
_failed_attempts = defaultdict(list)
_MAX_IPS = 1000  # cap to prevent unbounded memory
BLOCK_AFTER = 10
BLOCK_WINDOW = 300  # seconds


class DeviceUser(AnonymousUser):
    """Lightweight wrapper so DRF sees a 'user' with device context."""

    def __init__(self, device):
        super().__init__()
        self.device = device

    @property
    def is_authenticated(self):
        return True


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

        # Cap IP entries to prevent memory growth
        if len(_failed_attempts) > _MAX_IPS:
            oldest = sorted(_failed_attempts, key=lambda k: min(_failed_attempts[k], default=0))
            for k in oldest[:len(_failed_attempts) - _MAX_IPS]:
                del _failed_attempts[k]

        token_str = auth[7:].strip()
        try:
            device = DeviceToken.objects.get(token=token_str, is_active=True)
        except (DeviceToken.DoesNotExist, ValueError):
            _failed_attempts[ip].append(now)
            raise AuthenticationFailed('Invalid or inactive device token')

        from django.utils import timezone
        device.last_used = timezone.now()
        device.save(update_fields=['last_used'])

        # Return (user_wrapper, device_token) — device available via request.auth
        return (DeviceUser(device), device)


class IsDeviceAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return isinstance(getattr(request, 'auth', None), DeviceToken)
