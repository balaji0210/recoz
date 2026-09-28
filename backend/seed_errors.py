import sqlite3
import datetime

def seed():
    con = sqlite3.connect('backend/ricozappmon.db')
    cur = con.cursor()
    apps = cur.execute('SELECT id FROM applications').fetchall()
    app_id = apps[0][0] if apps else 'demo-ecommerce-app-id'
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    yesterday = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)).isoformat()

    groups = [
        ('err-1', app_id, 'a89f21000000', 'TypeError', "Cannot read properties of undefined (reading 'price')", 'unhandled', yesterday, now, 42, 19, '1.2.4'),
        ('err-2', app_id, '4d1290000000', 'NetworkError', 'Failed to fetch resource from CDN payment gateway', 'unhandled', yesterday, now, 14, 11, '1.2.4'),
        ('err-3', app_id, 'bc4471000000', 'ReferenceError', 'StripeCheckoutHandler is not defined', 'resolved', yesterday, now, 8, 5, '1.2.3'),
    ]

    for g in groups:
        cur.execute('''
        INSERT OR REPLACE INTO error_groups (id, application_id, fingerprint, error_type, message_template, status, first_seen, last_seen, occurrence_count, affected_users_count, last_release)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', g)

    con.commit()
    print('Seeded error groups successfully:', cur.execute('SELECT id, error_type, status FROM error_groups').fetchall())

if __name__ == '__main__':
    seed()
