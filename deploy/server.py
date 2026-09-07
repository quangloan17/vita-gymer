"""Waitress entrypoint with a single-instance guard and rotating logs."""
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import socket
import sys
import faulthandler

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))
os.chdir(root)
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.production'
runtime = json.loads((root / '.runtime' / 'config.json').read_text(encoding='utf-8'))
guard = socket.socket()
try:
    guard.bind(('127.0.0.1', 18765))
except OSError:
    sys.exit(0)
handler = RotatingFileHandler(root / '.runtime' / 'server.log', maxBytes=2_000_000, backupCount=3, encoding='utf-8')
logging.basicConfig(level=logging.INFO, handlers=[handler], format='%(asctime)s %(levelname)s %(name)s %(message)s')
trace_file=open(root / '.runtime' / 'startup-trace.log','w',encoding='utf-8')
faulthandler.dump_traceback_later(20,file=trace_file)
from django.core.wsgi import get_wsgi_application
from waitress import serve

application=get_wsgi_application()
faulthandler.cancel_dump_traceback_later()
serve(application, listen=runtime.get('listen','127.0.0.1:8765'), threads=4, url_scheme='https' if runtime.get('https',True) else 'http')
