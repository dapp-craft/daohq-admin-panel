import aiosqlite
from fastapi import APIRouter, Depends

from tools import (
    db_connection,
    check_system_token,
    scene_socket_manager,
    delete_s3_object,
)


router = APIRouter()


@router.get('/metrics/images')
async def get_metrics_content(
    db=Depends(db_connection),
):

    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        '''
        SELECT *
        FROM Metrics
        '''
    )

    metrics = await cursor.fetchall()
    metrics = [dict(metric) for metric in metrics]
    return metrics


@router.delete('/metrics/images/{metric_id}')
async def delete_metrics_content(
    metric_id: str,
    db=Depends(db_connection),
):

    cursor = await db.execute(
        '''
        SELECT s3_urn
        FROM Metrics
        WHERE id = ?1;
        ''',
        (metric_id,),
    )

    metric_for_deleting = await cursor.fetchone()

    await db.execute(
        '''
        DELETE FROM Metrics
        WHERE id = ?1
        ''',
        (metric_id,),
    )

    await db.commit()

    await delete_s3_object(metric_for_deleting[0])


@router.post('/metrics/images')
async def metrics_content(
    metrics: dict, db=Depends(db_connection), _=Depends(check_system_token)
):

    for metric_id, s3_urn in metrics.items():

        await db.execute(
            '''
            INSERT OR REPLACE INTO Metrics (id, s3_urn)
            VALUES (?1, ?2)
            ''',
            (metric_id, s3_urn),
        )

    await db.commit()

    await scene_socket_manager.broadcast({'type': 'metrics-updated', 'data': metrics})
