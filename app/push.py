"""Web Push opcional (requiere HTTPS, VAPID y autorización por dispositivo)."""
import json, os
from sqlalchemy import select
from .models import SessionLocal, PushSubscription


def send_push(message):
    key=os.getenv('VAPID_PRIVATE_KEY')
    email=os.getenv('VAPID_CONTACT','mailto:admin@example.com')
    if not key or not os.getenv('VAPID_PUBLIC_KEY'):
        return
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        return
    with SessionLocal() as db:
        for sub in db.scalars(select(PushSubscription)).all():
            try:
                webpush(subscription_info=json.loads(sub.subscription_json),
                        data=json.dumps({'title':'MegaBot','body':message}),
                        vapid_private_key=key,vapid_claims={'sub':email},ttl=3600)
            except Exception as exc:
                # Algunas suscripciones caducan y deben renovarse desde el dispositivo.
                status=getattr(getattr(exc,'response',None),'status_code',None)
                if status in (404,410): db.delete(sub)
        db.commit()
