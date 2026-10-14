"""Run against a disposable MySQL schema: TEST_DB_NAME must start with oe_test_.
Requires php, composer install in backend, and a reachable MySQL service.
Uses a local SMTP sink. No messages are sent to an external address.
"""
import concurrent.futures
import email
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import re
import socket
import socketserver
import subprocess
import threading
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DB_NAME = os.environ.get('TEST_DB_NAME', '')
assert DB_NAME.startswith('oe_test_'), 'Use a disposable TEST_DB_NAME beginning with oe_test_'

def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

messages = []
class SMTP(socketserver.StreamRequestHandler):
    def handle(self):
        self.wfile.write(b'220 local test sink\r\n')
        recipient = ''
        while line := self.rfile.readline():
            command = line.decode().strip()
            if command.upper().startswith(('EHLO', 'HELO')):
                self.wfile.write(b'250-localhost\r\n250 SIZE 2000000\r\n')
            elif command.upper().startswith('RCPT TO:'):
                recipient = command[8:].strip('<> ')
                self.wfile.write(b'250 OK\r\n')
            elif command.upper() == 'DATA':
                self.wfile.write(b'354 End with dot\r\n')
                lines = []
                while (chunk := self.rfile.readline()) != b'.\r\n':
                    if not chunk: break
                    lines.append(chunk)
                messages.append((recipient, email.message_from_bytes(b''.join(lines))))
                self.wfile.write(b'250 OK\r\n')
            elif command.upper() == 'QUIT':
                self.wfile.write(b'221 Bye\r\n'); break
            else: self.wfile.write(b'250 OK\r\n')

smtp = socketserver.ThreadingTCPServer(('127.0.0.1', 0), SMTP)
threading.Thread(target=smtp.serve_forever, daemon=True).start()
port = free_port()
origin = f'http://127.0.0.1:{port}'
env = dict(os.environ, APP_ENV='test', APP_URL=origin, APP_KEY='a'*64,
           DB_HOST=os.environ.get('TEST_DB_HOST', '127.0.0.1'), DB_PORT=os.environ.get('TEST_DB_PORT', '3306'),
           DB_NAME=DB_NAME, DB_USER=os.environ.get('TEST_DB_USER', 'root'), DB_PASSWORD=os.environ.get('TEST_DB_PASSWORD', ''),
           SMTP_HOST='127.0.0.1', SMTP_PORT=str(smtp.server_address[1]), SMTP_ENCRYPTION='none', SMTP_USER='', SMTP_PASSWORD='', MAIL_FROM='noreply@example.test')

def php(code):
    return subprocess.check_output(['php', '-r', "require 'backend/src/bootstrap.php';" + code], cwd=ROOT, env=env, text=True).strip()

subprocess.run(['php', 'backend/bin/migrate.php'], cwd=ROOT, env=env, check=True)
log = open(ROOT / 'backend-test.log', 'w')
server = subprocess.Popen(['php', '-S', f'127.0.0.1:{port}', '-t', 'dist', 'tests/router.php'], cwd=ROOT, env=env, stdout=log, stderr=log)

class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = ''; self.user = None
    def call(self, path, method='GET', data=None, extra=None):
        headers = {'Accept':'application/json', 'Origin':origin, 'X-CSRF-Token':self.csrf}
        if data is not None: headers['Content-Type']='application/json'
        if self.user: headers['X-OE-Account']=self.user
        headers.update(extra or {})
        req = urllib.request.Request(origin+'/api/'+path, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
        try: response = self.opener.open(req)
        except urllib.error.HTTPError as error: response = error
        result = json.loads(response.read())
        if result.get('csrf'): self.csrf = result['csrf']
        if result.get('user'): self.user = result['user']['id']
        return response.status, result

def token_for(address, kind):
    for recipient, mail in reversed(messages):
        if recipient == address:
            text = mail.get_payload(decode=True).decode('utf8')
            found = re.search(kind+r'_token=([a-f0-9]{64})', text)
            if found: return found.group(1)
    raise AssertionError('Expected test message')

def register(address):
    c=Client(); assert c.call('session')[0]==200
    assert c.call('auth/register','POST',{'email':address,'name':'Test User','password':'Correct-Horse-2026'})[0]==202
    assert c.call('auth/login','POST',{'email':address,'password':'Correct-Horse-2026'})[0]==403
    token=token_for(address,'verify')
    assert c.call('auth/verify','POST',{'token':token})[0]==200
    assert c.call('auth/verify','POST',{'token':token})[0]==400
    assert c.call('auth/login','POST',{'email':address,'password':'Correct-Horse-2026'})[0]==200
    return c

try:
    for _ in range(60):
        try:
            guest=Client(); assert guest.call('session')[0]==200;break
        except (OSError,AssertionError): time.sleep(.1)
    else: raise RuntimeError('PHP test server did not start')
    assert guest.call('workspace')[0]==401
    assert guest.call('auth/login','POST',{}, {'Origin':'https://evil.test'})[0]==403
    assert guest.call('auth/login','POST',{}, {'X-CSRF-Token':'wrong'})[0]==403
    stamp=str(time.time_ns())
    first=register('one'+stamp+'@example.test'); second=register('two'+stamp+'@example.test')
    assert first.user != second.user
    assert php("echo password_get_info(query('SELECT password_hash FROM users WHERE id=?',['"+first.user+"'])->fetchColumn())['algoName'];") != 'unknown'
    workspace={'schema':2,'draft':{'title':'Private quote','items':[{'name':'Work','qty':1,'price':100}]},'versions':[]}
    assert first.call('workspace','PUT',{'revision':0,'workspace':workspace})[0]==200
    assert second.call('workspace')[1]['workspace'] is None
    assert second.call('workspace','PUT',{'revision':0,'workspace':workspace},{'X-OE-Account':first.user})[0]==409
    assert first.call('workspace','PUT',{'revision':0,'workspace':workspace})[0]==409
    assert first.call('workspace')[1]['workspace']['draft']['title']=='Private quote'
    other_device=Client();other_device.call('session');assert other_device.call('auth/login','POST',{'email':'one'+stamp+'@example.test','password':'Correct-Horse-2026'})[0]==200
    assert other_device.call('workspace')[1]['workspace']['draft']['title']=='Private quote'
    invalid={'schema':2,'draft':{'items':[{'name':'bad','qty':-1,'price':5}]},'versions':[]}
    assert first.call('workspace','PUT',{'revision':1,'workspace':invalid})[0]==422
    # Recovery is one-time and revokes every earlier login session.
    assert first.call('auth/forgot','POST',{'email':'one'+stamp+'@example.test'})[0]==202
    token=token_for('one'+stamp+'@example.test','reset')
    assert guest.call('auth/reset','POST',{'token':token,'password':'Changed-Horse-2026'})[0]==200
    assert other_device.call('workspace')[0]==401
    assert guest.call('auth/reset','POST',{'token':token,'password':'Changed-Horse-2026'})[0]==400
    assert guest.call('auth/login','POST',{'email':'one'+stamp+'@example.test','password':'Correct-Horse-2026'})[0]==401
    assert guest.call('auth/login','POST',{'email':'one'+stamp+'@example.test','password':'Changed-Horse-2026'})[0]==200
    assert guest.call('auth/logout','POST',{})[0]==200;assert guest.call('workspace')[0]==401
    guest.call('session')
    for _ in range(10): status,_=guest.call('auth/login','POST',{'email':'missing'+stamp+'@example.test','password':'wrong'})
    assert guest.call('auth/login','POST',{'email':'missing'+stamp+'@example.test','password':'wrong'})[0]==429
    print('PHP/MySQL: registration, email verification, login, sessions, CSRF, per-user persistence, conflicts, validation, password reset, logout and rate limits passed.')
finally:
    server.terminate();server.wait(timeout=5);log.close();smtp.shutdown();smtp.server_close()
