import asyncio, os, uuid
from pathlib import Path
from sqlalchemy import select
from .models import SessionLocal, GenerationJob, GeneratedImage, Notification, Product, DATA
from .imaging import compose_photo, ai_photo
from .push import send_push

FILES=DATA/'private'
FILES.mkdir(parents=True,exist_ok=True)

async def worker_loop(on_event):
    # Single worker process only. Database status survives restarts.
    with SessionLocal() as db:
        for j in db.scalars(select(GenerationJob).where(GenerationJob.status=='running')):
            j.status='queued'
        db.commit()
    while True:
        try:
            with SessionLocal() as db:
                job=db.scalar(select(GenerationJob).where(GenerationJob.status=='queued').order_by(GenerationJob.id))
                job_id=job.id if job else None
                if job:
                    job.status='running'; db.commit()
            if job_id:
                await process_job(job_id,on_event)
            else:
                await asyncio.sleep(1.2)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print('Error del worker:',type(exc).__name__,str(exc)[:100])
            await asyncio.sleep(2)

async def process_job(job_id,on_event):
    with SessionLocal() as db:
        job=db.get(GenerationJob,job_id)
        product=db.get(Product,job.product_id)
        if not product or not product.photos:
            job.status='failed'; job.error='Agrega primero fotografías reales al producto.'; db.commit();await on_event();return
        references=[FILES/p.filename for p in product.photos]
        mode,target,completed=job.mode,job.target,job.completed
        name,desc,price=product.name,product.description,float(product.sale_price)
    try:
        if mode=='ia' and not os.getenv('OPENAI_API_KEY'):
            raise RuntimeError('Configura OPENAI_API_KEY en .env para utilizar la generación de IA.')
        for i in range(completed,target):
            file_name=f'{uuid.uuid4().hex}.jpg'
            out=FILES/file_name
            original=references[i%len(references)]
            if mode=='plantillas':
                await asyncio.to_thread(compose_photo,original,out,name,price,i)
            else:
                await asyncio.to_thread(ai_photo,original,out,name,desc,price,i,os.getenv('IMAGE_MODEL','gpt-image-1.5'),os.getenv('OPENAI_API_KEY'))
            with SessionLocal() as db:
                job=db.get(GenerationJob,job_id)
                job.items.append(GeneratedImage(filename=file_name))
                job.completed=i+1
                db.commit()
            await on_event()
        with SessionLocal() as db:
            job=db.get(GenerationJob,job_id)
            job.status='done'
            db.add(Notification(message=f'¡Listas las {target} imágenes del producto «{name}»! Lote #{job_id}.'))
            db.commit()
        await asyncio.to_thread(send_push,f'¡Listas las {target} imágenes de {name}!')
    except Exception as exc:
        with SessionLocal() as db:
            job=db.get(GenerationJob,job_id)
            job.status='failed';job.error=str(exc)[:700];db.commit()
            db.add(Notification(message=f'El lote #{job_id} se detuvo en {job.completed}/{job.target}: revisa el error.'))
            db.commit()
    await on_event()
