from fastapi import APIRouter, Depends, Response
from tools import db_connection, CheckRole, check_system_token


router = APIRouter()


@router.post('/admins/{address}')
async def add_admin_rights(
    address: str, db=Depends(db_connection), _=Depends(CheckRole(('superadmin',)))
):

    cursor = await db.execute(
        '''
        SELECT COUNT(*) 
        FROM User 
        WHERE address = ?1
        ''',
        (address,),
    )
    user_exists = await cursor.fetchone()
    user_exists = user_exists[0]
    if user_exists:
        await db.execute(
            '''
            UPDATE User
            SET role = 'admin'
            WHERE address = ?1
            ''',
            (address,),
        )
    else:
        await db.execute(
            '''
            INSERT INTO User (address, role)
            VALUES (?1, 'admin')
            ''',
            (address,),
        )

    await db.commit()


@router.post('/superadmins/{address}')
async def add_superadmin_rights(
    address: str, db=Depends(db_connection), _=Depends(check_system_token)
):

    cursor = await db.execute(
        '''
        SELECT COUNT(*) 
        FROM User 
        WHERE address = ?1
        ''',
        (address,),
    )
    user_exists = await cursor.fetchone()
    user_exists = user_exists[0]
    if user_exists:
        await db.execute(
            '''
            UPDATE User
            SET role = 'superadmin'
            WHERE address = ?1
            ''',
            (address,),
        )
    else:
        await db.execute(
            '''
            INSERT INTO User (address, role)
            VALUES (?1, 'superadmin')
            ''',
            (address,),
        )

    await db.commit()


@router.delete('/admins/{address}')
async def remove_admin_rights(
    address: str, db=Depends(db_connection), _=Depends(CheckRole(('superadmin',)))
):

    await db.execute(
        '''
            UPDATE User
            SET role = NULL
            WHERE address = ?1
            ''',
        (address,),
    )

    await db.commit()


@router.get('/admins')
async def get_all_admins(
    db=Depends(db_connection), _=Depends(CheckRole(('superadmin',)))
):

    result = []

    cursor = await db.execute(
        '''
        SELECT address, role
        FROM User
        WHERE role IS NOT NULL
        '''
    )
    admins = await cursor.fetchall()
    if not admins:
        return result

    for admin in admins:
        result.append({'address': admin[0], 'role': admin[1]})

    return result


@router.get('/users/role/{address}')
async def get_user_role(address: str, db=Depends(db_connection)):

    cursor = await db.execute(
        '''
            SELECT role
            FROM User
            WHERE address = ?1
            ''',
        (address,),
    )
    address = await cursor.fetchone()
    if address:
        return {'role': address[0]}
    else:
        return Response(status_code=404, content="User not found")


@router.get('/users')
async def get_all_users(
    db=Depends(db_connection), _=Depends(CheckRole(('superadmin',)))
):

    cursor = await db.execute(
        '''
        SELECT address, role
        FROM User
        '''
    )
    users = await cursor.fetchall()
    if not users:
        return []

    # TODO: figure out default role for user
    result = [{'address': address, 'role': role or ""} for address, role in users]

    return result
