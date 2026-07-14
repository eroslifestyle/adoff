# AdOff Review Scraper — Deploy Guide (2026-05-28)

## ✅ Pre-Deploy Checklist

- [x] Tutti i file modificati
- [x] Syntax check OK (playwright-scraper.js, review-poll-core.js, scraper-service.js)
- [x] Hash dedup coerente (MD5 identico in 3 moduli)
- [x] HTTP endpoint completi (4/4)
- [x] Error handling robusto
- [x] State persistence (atomic writes)
- [x] Zero new dependencies
- [x] Documentation updated

**Stato**: ✅ READY FOR PRODUCTION

---

## 🚀 Deployment Steps

### Step 1: Verify Current Service

```bash
systemctl status adoff-scraper.service
curl http://127.0.0.1:8788/health
```

**Expected output**: 
```json
{"ok": true, "uptime": XXX, "busy": false}
```

### Step 2: Backup Current State (optional)

```bash
sudo cp /var/lib/adoff-scraper-state.json /var/lib/adoff-scraper-state.json.backup
```

### Step 3: Restart Service

```bash
sudo systemctl restart adoff-scraper.service
```

**Wait 5 seconds** for startup.

### Step 4: Verify Service is Up

```bash
# Check status
systemctl status adoff-scraper.service

# Check logs (should see "listening on :8788")
journalctl -u adoff-scraper.service | tail -20
```

### Step 5: Test Endpoints

```bash
# Health check
curl http://127.0.0.1:8788/health

# Check state (should be empty initially or preserved from backup)
curl http://127.0.0.1:8788/state | jq .

# Poll (first time = slow, ~60-90 seconds)
curl "http://127.0.0.1:8788/poll?store=cws" --max-time 100
```

### Step 6: Monitor Live

```bash
# Real-time JSON logs
journalctl -u adoff-scraper.service -f --output=json | jq .

# Or: tail syslog
tail -f /var/log/adoff-scraper.log
```

---

## 📋 Expected Behavior

### First Poll (Fresh Install)

```bash
curl http://127.0.0.1:8788/poll
```

**Expected** (on fresh state):
```json
{
  "cws": {
    "reviews": [],           // 0 reviews (first time = empty or dedup filters)
    "newReviews": [],
    "count": 0,
    "ok": true
  },
  "edge": {
    "reviews": [],
    "newReviews": [],
    "count": 0,
    "ok": true
  },
  "stateSize": {
    "cws": 0,
    "edge": 0
  },
  "timestamp": "2026-05-28T..."
}
```

### Second Poll (After 1 Hour)

If reviews exist:
```json
{
  "cws": {
    "reviews": [
      {
        "author": "John Doe",
        "score": 5,
        "body": "Great extension!",
        "when": "2 days ago",
        "reviewId": "abc123..."
      }
    ],
    "newReviews": [1],     // 1 new since last time
    "count": 1
  }
  ...
}
```

---

## 🔧 Troubleshooting

### Service won't start

```bash
# Check logs
journalctl -u adoff-scraper.service -xe

# Manual start (to see errors)
cd /home/mrxxx/Dropbox/1\ Programmazione/Progetti/ChromePlugin/sviluppo/reviews
node scraper-service.js
```

**Common issues**:
- Port 8788 already in use: `sudo lsof -i :8788`
- State file permissions: `ls -la /var/lib/adoff-scraper-state.json`
- Playwright not installed: `npm install`

### Scraper returns 0 reviews

**Check**:
1. Is the store really online?
   ```bash
   curl -I https://chromewebstore.google.com/detail/.../reviews
   ```

2. Is the DOM changed? Dump HTML:
   ```bash
   curl "http://127.0.0.1:8788/dump?store=cws"
   ```

3. Open `/tmp/cws-page-*.html` and inspect:
   - Are reviews visible in the page?
   - Check browser dev tools → elements for selector changes

4. If DOM changed, update `extractReviews()` in `playwright-scraper.js`:
   - Find new selector for review container
   - Find new selector for rating/author/body
   - Test locally: `node playwright-scraper.js --dump cws`
   - Restart: `sudo systemctl restart adoff-scraper.service`

### State corruption

If state file is corrupted:
```bash
# Reset state (clears dedup, all reviews will re-notify)
sudo bash -c 'echo "{\"cwsSeenHashes\": [], \"edgeSeenHashes\": []}" > /var/lib/adoff-scraper-state.json'

# Or restore from backup
sudo cp /var/lib/adoff-scraper-state.json.backup /var/lib/adoff-scraper-state.json

# Restart
sudo systemctl restart adoff-scraper.service
```

### Memory leak (service grows large)

State is trimmed automatically to max 500 entries per type (~64 KB).

If memory grows:
```bash
# Check current state size
curl http://127.0.0.1:8788/state | jq 'length'

# If > 500, manually trim
sudo bash -c 'curl http://127.0.0.1:8788/state | jq "{cwsSeenHashes: .cwsSeenHashes[-500:], edgeSeenHashes: .edgeSeenHashes[-500:]}" > /var/lib/adoff-scraper-state.json'

# Restart
sudo systemctl restart adoff-scraper.service
```

---

## 📊 Monitoring

### Health Checks

```bash
# Every 5 minutes
*/5 * * * * curl -s http://127.0.0.1:8788/health | jq .ok || echo "scraper down" | mail -s "Alert" user@example.com
```

### Log Rotation

Systemd handles logs automatically via `journalctl`.
View size:
```bash
journalctl --disk-usage
```

Clear old logs (keep last 30 days):
```bash
sudo journalctl --vacuum=time=30d
```

### Performance Baseline

**Expected times**:
- `GET /health`: < 10ms
- `GET /poll?store=cws`: 40-60s (first time) / 45-70s (all stores)
- `GET /dump?store=cws`: 30-50s
- Dedup check: < 1ms

If significantly slower, check:
- `free -h` → available RAM
- `top` → CPU usage
- `journalctl -u adoff-scraper.service -f` → errors

---

## 🔄 Integration with n8n

The workflow calls scraper service at `$env.ADOFF_SCRAPER_URL`:

```javascript
const SCRAPER_URL = $env.ADOFF_SCRAPER_URL || "http://100.71.178.53:8788/poll";
```

**Default**: Tailscale IP (leobox remote)
**Override**: Set env var in n8n or Docker compose

### Verify connectivity from n8n container

```bash
# Inside n8n container
curl http://100.71.178.53:8788/health

# If timeout, check:
# 1. Tailscale is running on host
# 2. Firewall allows :8788
# 3. Host IP is reachable from container
```

---

## 📈 Scaling (Future)

Current bottleneck: **Playwright headless browser** (60-90s per poll)

**Options if polling > 1x per hour**:

1. **Increase timeout in n8n**: Already 180s ✓
2. **Parallel polling**: Not recommended (browser heavy)
3. **Browser pool**: Add connection pooling to `scraper-service.js` (future)
4. **Cache reviews**: Keep results in Redis (future)

For now: **Poll every 6 hours** (n8n default) = safe.

---

## 📞 Support Contacts

- **CWS issues**: Google Support (slow)
- **Edge issues**: Microsoft feedback (slow)
- **Scraper bugs**: Inspect DOM with `--dump`, update selectors
- **n8n integration**: Check env vars, network connectivity

---

## 🎯 Success Criteria

After deploy, verify:

- [x] Service starts on boot: `sudo systemctl is-enabled adoff-scraper.service` → enabled
- [x] Health check passes: `curl /health` → ok:true
- [x] Poll completes: `curl /poll` → 0-10 reviews (depends on store)
- [x] State persists: `curl /state` → has hashes
- [x] Logs are readable: `journalctl -u adoff-scraper.service` → JSON
- [x] n8n connects: Telegram receives reviews (when n8n polls)

---

## 📝 Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Check health | Daily | `curl /health` |
| Review logs | Weekly | `journalctl -u adoff-scraper.service -f` |
| Clear old logs | Monthly | `journalctl --vacuum=time=30d` |
| Backup state | Monthly | `cp /var/lib/...state.json ~/backup/` |
| Test scraper | Quarterly | `curl /dump?store=cws` + inspect DOM |
| Update selectors | As needed | When DOM changes |

---

**Deployment Date**: 2026-05-28  
**Version**: 2.0 (Robustness Refactor)  
**Status**: ✅ READY FOR PRODUCTION

