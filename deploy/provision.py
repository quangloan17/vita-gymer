"""Create local deployment config and provision the explicitly requested account."""
import json
import os
from pathlib import Path
import secrets
import sys

root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root))
directory=root/'.runtime'
directory.mkdir(exist_ok=True)
config=directory/'config.json'
if not config.exists():
    config.write_text(json.dumps({'secret_key':secrets.token_urlsafe(64),'allowed_hosts':['localhost','127.0.0.1','100.88.123.53','loan-pc-anh-hoadon.tail559ecf.ts.net'],'trusted_origins':['https://loan-pc-anh-hoadon.tail559ecf.ts.net'],'https':True,'listen':'127.0.0.1:8765'},indent=2),encoding='utf-8')
os.environ['DJANGO_SETTINGS_MODULE']='config.production'
import django
django.setup()
from django.contrib.auth import get_user_model
from accounts.models import UserProfile
user,created=get_user_model().objects.get_or_create(username='quang')
user.set_password(os.environ['VITA_ACCOUNT_PASSWORD'])
user.is_active=True
user.save()
UserProfile.objects.get_or_create(user=user,defaults={'name':'Quang'})
print('Account quang is ready. Password is hashed in database.')
