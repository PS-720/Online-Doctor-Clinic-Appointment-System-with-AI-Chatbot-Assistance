import json
import urllib.request

def post(msg):
    data = json.dumps({'message': msg, 'session_id': 'test_1'}).encode('utf-8')
    req = urllib.request.Request('http://localhost:5050/api/chat', data=data, headers={'Content-Type': 'application/json'})
    response = urllib.request.urlopen(req)
    print(response.read().decode())

post('I have a severe headache')
post('yes')
post('yes')
post('yes')
