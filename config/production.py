"""Local deployment settings. Secrets live in ignored .runtime/config.json."""
import json
import os
from pathlib import Path

runtime = json.loads((Path(__file__).resolve().parent.parent / '.runtime' / 'config.json').read_text(encoding='utf-8'))
os.environ['SECRET_KEY'] = runtime['secret_key']
os.environ['VITA_DEBUG'] = '0'
os.environ['ALLOWED_HOSTS'] = ','.join(runtime['allowed_hosts'])
from .settings import *

MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STORAGES = {'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'}, 'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'}}
CSRF_TRUSTED_ORIGINS = runtime['trusted_origins']
SESSION_COOKIE_SECURE = runtime.get('https', True)
CSRF_COOKIE_SECURE = runtime.get('https', True)
SECURE_REFERRER_POLICY = 'same-origin'
DATABASES['default'].setdefault('OPTIONS', {})
if DATABASES['default']['ENGINE'].endswith('sqlite3'):
    DATABASES['default']['OPTIONS']['timeout'] = 30
