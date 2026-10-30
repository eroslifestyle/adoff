import urllib.request, urllib.parse, json
data=urllib.parse.urlencode({'grant_type':'refresh_token','refresh_token':'t0zIVKX_r8prKu45oXAN2m1DzDDr4tgup_QusKunHeY.WEB85BLJ4sqVaU-GoGyn51Mc6IpBjJHbH_3flGVjOQI','client_id':'54d11594-84e4-41aa-b438-e81b8fa78ee7'}).encode()
req=urllib.request.Request('https://oauth2.cloudflare.com/token',data=data)
req.add_header('Content-Type','application/x-www-form-urlencoded')
resp=urllib.request.urlopen(req)
result=json.loads(resp.read())
print('TOKEN:'+result.get('access_token','FAILED'))
print('EXPIRES:'+str(result.get('expires_in',0)))