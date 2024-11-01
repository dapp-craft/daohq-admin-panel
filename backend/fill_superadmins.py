import sqlite3


conn = sqlite3.connect('database.sqlite')
cursor = conn.cursor()


users = [
    '0xdab8e1757f01bcA432c28A7ddF9947226b742ba6',
    '0xfB9Be15d1De746d50aC9A9F0F7669F505521E4F7',
    '0x4F1469317d0104A45eBE6Cb6B0661E22173F2Cc3',
    '0x24C5c0349DD34cefc783faCaC92C5acD845Bc2D9',
    '0x41eb5F82af60873b3C14fEDB898A1712f5c35366',
    '0xb9cE63B2Df603c417d12d9ceA3A81c019b190Fcc',
    '0x7535AA1A38Ca2F4655F6d8d6aBf6c6AB46e5790D',
]


for user in users:
    cursor.execute(
        '''
        INSERT INTO User (address, role)
        VALUES (?1, ?2)
        ''',
        (user, 'superadmin'),
    )

conn.commit()
conn.close()
