from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import sqlite3
import os
import tempfile
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'royal_aviator_ramraj_boss_secret'

# Vercel aur local dono ke liye 100% writable temporary folder ka path
DB_PATH = os.path.join(tempfile.gettempdir(), 'royal_database.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    # Users Table
    conn.execute('''CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mobile TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        balance REAL DEFAULT 100.0)''')
    
    # Deposits Table
    conn.execute('''CREATE TABLE IF NOT EXISTS deposits (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mobile TEXT NOT NULL,
                        amount REAL NOT NULL,
                        utr TEXT NOT NULL,
                        status TEXT DEFAULT 'Pending',
                        created_at TEXT)''')

    # Withdrawals Table
    conn.execute('''CREATE TABLE IF NOT EXISTS withdrawals (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mobile TEXT NOT NULL,
                        amount REAL NOT NULL,
                        upi_id TEXT NOT NULL,
                        status TEXT DEFAULT 'Pending',
                        created_at TEXT)''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    if 'mobile' in session:
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE mobile = ?', (session['mobile'],)).fetchone()
        deposits = conn.execute('SELECT * FROM deposits WHERE mobile = ? ORDER BY id DESC', (session['mobile'],)).fetchall()
        withdrawals = conn.execute('SELECT * FROM withdrawals WHERE mobile = ? ORDER BY id DESC', (session['mobile'],)).fetchall()
        conn.close()
        return render_template('index.html', user=user, deposits=deposits, withdrawals=withdrawals)
    return render_template('index.html', user=None)

@app.route('/register', methods=['POST'])
def register():
    mobile = request.form['mobile'].strip()
    password = request.form['password'].strip()
    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO users (mobile, password, balance) VALUES (?, ?, ?)', (mobile, password, 100.0))
        conn.commit()
        session['mobile'] = mobile
    except sqlite3.IntegrityError:
        conn.close()
        return "<script>alert('Yeh mobile number pehle se registered hai!'); window.location='/';</script>"
    conn.close()
    return redirect(url_for('index'))

@app.route('/login', methods=['POST'])
def login():
    mobile = request.form['mobile'].strip()
    password = request.form['password'].strip()
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE mobile = ? AND password = ?', (mobile, password)).fetchone()
    conn.close()
    if user:
        session['mobile'] = mobile
        return redirect(url_for('index'))
    return "<script>alert('Galat mobile number ya password!'); window.location='/';</script>"

@app.route('/logout')
def logout():
    session.pop('mobile', None)
    return redirect(url_for('index'))

@app.route('/deposit_request', methods=['POST'])
def deposit_request():
    if 'mobile' not in session:
        return redirect(url_for('index'))
    amount = float(request.form['amount'])
    utr = request.form['utr'].strip()
    now = datetime.now().strftime("%d %b, %I:%M %p")
    
    conn = get_db_connection()
    conn.execute('INSERT INTO deposits (mobile, amount, utr, status, created_at) VALUES (?, ?, ?, ?, ?)',
                 (session['mobile'], amount, utr, 'Pending', now))
    conn.commit()
    conn.close()
    return "<script>alert('Deposit request bhej di gayi hai!'); window.location='/';</script>"

@app.route('/withdraw_request', methods=['POST'])
def withdraw_request():
    if 'mobile' not in session:
        return redirect(url_for('index'))
    amount = float(request.form['amount'])
    upi_id = request.form['upi_id'].strip()
    now = datetime.now().strftime("%d %b, %I:%M %p")
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE mobile = ?', (session['mobile'],)).fetchone()
    if not user or amount < 100 or amount > user['balance']:
        conn.close()
        return "<script>alert('Minimum withdrawal ₹100 hai ya aapka balance kam hai!'); window.location='/';</script>"
    
    conn.execute('UPDATE users SET balance = balance - ? WHERE mobile = ?', (amount, session['mobile']))
    conn.execute('INSERT INTO withdrawals (mobile, amount, upi_id, status, created_at) VALUES (?, ?, ?, ?, ?)',
                 (session['mobile'], amount, upi_id, 'Pending', now))
    conn.commit()
    conn.close()
    return "<script>alert('Withdrawal request bhej di gayi hai!'); window.location='/';</script>"

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    conn = get_db_connection()
    if request.method == 'POST':
        req_type = request.form['req_type']
        req_id = request.form['req_id']
        action = request.form['action']
        
        if req_type == 'deposit':
            dep = conn.execute('SELECT * FROM deposits WHERE id = ?', (req_id,)).fetchone()
            if dep and dep['status'] == 'Pending':
                if action == 'approve':
                    conn.execute('UPDATE users SET balance = balance + ? WHERE mobile = ?', (dep['amount'], dep['mobile']))
                    conn.execute("UPDATE deposits SET status = 'Approved' WHERE id = ?", (req_id,))
                else:
                    conn.execute("UPDATE deposits SET status = 'Rejected' WHERE id = ?", (req_id,))
        
        elif req_type == 'withdraw':
            wit = conn.execute('SELECT * FROM withdrawals WHERE id = ?', (req_id,)).fetchone()
            if wit and wit['status'] == 'Pending':
                if action == 'approve':
                    conn.execute("UPDATE withdrawals SET status = 'Approved' WHERE id = ?", (req_id,))
                else:
                    conn.execute('UPDATE users SET balance = balance + ? WHERE mobile = ?', (wit['amount'], wit['mobile']))
                    conn.execute("UPDATE withdrawals SET status = 'Rejected' WHERE id = ?", (req_id,))
        conn.commit()
        
    deposits = conn.execute('SELECT * FROM deposits ORDER BY id DESC').fetchall()
    withdrawals = conn.execute('SELECT * FROM withdrawals ORDER BY id DESC').fetchall()
    users = conn.execute('SELECT * FROM users ORDER BY id DESC').fetchall()
    conn.close()
    return render_template('admin.html', deposits=deposits, withdrawals=withdrawals, users=users)

@app.route('/place_bet', methods=['POST'])
def place_bet():
    if 'mobile' not in session:
        return jsonify({'success': False, 'msg': 'Login karein'})
    try:
        data = request.get_json()
        if not data or 'amount' not in data:
            return jsonify({'success': False, 'msg': 'Invalid data'})
        
        amount = float(data['amount'])
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE mobile = ?', (session['mobile'],)).fetchone()
        
        if not user or amount <= 0 or user['balance'] < amount:
            conn.close()
            return jsonify({'success': False, 'msg': 'Insufficient Balance!'})
        
        new_bal = user['balance'] - amount
        conn.execute('UPDATE users SET balance = ? WHERE mobile = ?', (new_bal, session['mobile']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'new_balance': new_bal})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)})

@app.route('/cashout', methods=['POST'])
def cashout():
    if 'mobile' not in session:
        return jsonify({'success': False})
    try:
        data = request.get_json()
        win_amount = float(data['win_amount'])
        
        conn = get_db_connection()
        conn.execute('UPDATE users SET balance = balance + ? WHERE mobile = ?', (win_amount, session['mobile']))
        conn.commit()
        user = conn.execute('SELECT * FROM users WHERE mobile = ?', (session['mobile'],)).fetchone()
        conn.close()
        return jsonify({'success': True, 'new_balance': user['balance']})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)})

if __name__ == '__main__':
    app.run(debug=True, port=500)