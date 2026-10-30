    // =============================================
    // STATE
    // =============================================
    let apiUrl = "";
    let adminToken = ""; // solo in memoria (niente sessionStorage): si perde al refresh, va ridigitato
    let licenses = []; // local cache

    // Escape HTML per OGNI valore che arriva da API/utente prima di finire in innerHTML
    function esc(v) {
      return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    }

    // Allowlist origin API: solo HTTPS su domini AdOff (export per admin-console che condivide /assets/security.js)
    const API_ALLOWED_ORIGINS = ["https://api.adoff.app", "https://adoff.app"];
    function isAllowedApiOrigin(u) {
      try { const o = new URL(u); return o.protocol === "https:" && API_ALLOWED_ORIGINS.includes(o.origin); }
      catch { return false; }
    }

    const LS_KEY = "adoff_admin_licenses";

    function loadLocal() {
      try { licenses = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch(_) { licenses = []; }
    }
    function saveLocal() {
      localStorage.setItem(LS_KEY, JSON.stringify(licenses));
    }

    // =============================================
    // UI HELPERS
    // =============================================
    function toast(msg, isError) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.className = "toast show" + (isError ? " error" : "");
      setTimeout(() => t.className = "toast", 3000);
    }

    function setStatus(ok) {
      const el = document.getElementById("apiStatus");
      el.textContent = ok ? "Connesso" : "Non connesso";
      el.className = "status" + (ok ? "" : " offline");
    }

    // =============================================
    // TABS
    // =============================================
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById("panel-" + tab.dataset.panel).classList.add("active");
        // Refresh server data when switching to licenses tab
        if (tab.dataset.panel === "licenses" && apiUrl && adminToken) {
          loadServerLicenses();
        }
        if (tab.dataset.panel === "gsc" && apiUrl && adminToken) {
          loadGsc();
        }
        if (tab.dataset.panel === "retention" && apiUrl && adminToken) {
          loadRetention();
        }
      });
    });

    // =============================================
    // GOOGLE SEARCH CONSOLE
    // =============================================
    function gscEsc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

    function gscTable(rows, labelTrunc) {
      if (!rows || !rows.length) return '<div style="padding:12px;color:#5a5a7a;font-size:12px;">nessun dato</div>';
      let h = '<table style="width:100%;font-size:12px;"><thead><tr style="color:#8a8aaa;text-align:left;">' +
        '<th style="padding:6px 12px;">Voce</th><th style="padding:6px;text-align:right;">Clk</th><th style="padding:6px;text-align:right;">Impr</th><th style="padding:6px;text-align:right;">CTR</th><th style="padding:6px 12px;text-align:right;">Pos</th></tr></thead><tbody>';
      for (const r of rows) {
        let label = r.key || "";
        if (labelTrunc && label.length > labelTrunc) label = label.slice(0, labelTrunc) + "…";
        h += '<tr style="border-top:1px solid #1a1a36;">' +
          '<td style="padding:6px 12px;" title="' + gscEsc(r.key) + '">' + gscEsc(label) + '</td>' +
          '<td style="padding:6px;text-align:right;color:#4ade80;">' + r.clicks + '</td>' +
          '<td style="padding:6px;text-align:right;">' + r.impressions + '</td>' +
          '<td style="padding:6px;text-align:right;color:#8a8aaa;">' + r.ctr + '%</td>' +
          '<td style="padding:6px 12px;text-align:right;color:#7c5cfc;">' + r.position + '</td></tr>';
      }
      return h + '</tbody></table>';
    }

    function gscKpi(label, val, sub) {
      return '<div class="table-wrap" style="padding:14px 16px;"><div style="font-size:11px;color:#8a8aaa;">' + label +
        '</div><div style="font-size:24px;font-weight:700;margin-top:4px;">' + val +
        '</div><div style="font-size:11px;color:#5a5a7a;">' + (sub || "") + '</div></div>';
    }

    function renderTrend(trend) {
      const svg = document.getElementById("gscTrend");
      if (!trend || trend.length < 2) { svg.innerHTML = ""; return; }
      const max = Math.max(...trend.map(t => t.impressions), 1);
      const W = 300, H = 60, step = W / (trend.length - 1);
      let pts = trend.map((t, i) => (i * step).toFixed(1) + "," + (H - (t.impressions / max) * (H - 6) - 2).toFixed(1)).join(" ");
      svg.innerHTML = '<polyline fill="none" stroke="#7c5cfc" stroke-width="2" points="' + pts + '"/>' +
        '<polyline fill="rgba(124,92,252,0.12)" stroke="none" points="0,' + H + ' ' + pts + ' ' + W + ',' + H + '"/>';
    }

    function renderGsc(snap) {
      const grid = document.getElementById("gscGrid"), empty = document.getElementById("gscEmpty");
      if (!snap) { grid.style.display = "none"; document.getElementById("gscKpis").innerHTML = ""; document.getElementById("gscTrend").innerHTML = ""; empty.style.display = "block"; return; }
      grid.style.display = "grid"; empty.style.display = "none";
      document.getElementById("gscRange").textContent = snap.range ? (snap.range.start + " → " + snap.range.end + " (" + snap.range.days + "g)") : "—";
      document.getElementById("gscUpdated").textContent = snap.updatedAt ? new Date(snap.updatedAt).toLocaleString("it-IT") : "mai";
      const t = snap.totals || {};
      document.getElementById("gscKpis").innerHTML =
        gscKpi("Click", t.clicks || 0, "ultimi 28g") +
        gscKpi("Impression", t.impressions || 0, "ultimi 28g") +
        gscKpi("CTR medio", (t.ctr || 0) + "%", "click/impression") +
        gscKpi("Posizione media", t.position || 0, "più basso = meglio");
      renderTrend(snap.trend);
      document.getElementById("gscOpp").innerHTML = gscTable(snap.opportunities, 38);
      document.getElementById("gscQueries").innerHTML = gscTable(snap.topQuery, 38);
      document.getElementById("gscPages").innerHTML = gscTable((snap.topPage || []).map(r => ({ ...r, key: r.key.replace(/^https?:\/\/adoff\.app/, "") || "/" })), 38);
      document.getElementById("gscCountries").innerHTML = gscTable(snap.topCountry, 38);
    }

    async function loadGsc() {
      if (!apiUrl || !adminToken) { toast("Connettiti prima", true); return; }
      try {
        const resp = await fetch(apiUrl + "/admin/gsc", { headers: { "X-Admin-Token": adminToken } });
        const data = await resp.json();
        if (!data.ok) { toast("GSC: " + (data.error || "errore"), true); return; }
        renderGsc(data.snapshot);
      } catch (e) { toast("GSC errore: " + e.message, true); }
    }

    document.getElementById("btnGscSync").addEventListener("click", async () => {
      if (!apiUrl || !adminToken) { toast("Connettiti prima", true); return; }
      const btn = document.getElementById("btnGscSync");
      btn.disabled = true; btn.textContent = "⏳ Aggiorno…";
      try {
        const resp = await fetch(apiUrl + "/admin/gsc/sync", { method: "POST", headers: { "X-Admin-Token": adminToken } });
        const data = await resp.json();
        if (!data.ok) { toast("Sync fallita: " + (data.error || "errore"), true); }
        else { toast("Aggiornato: " + data.clicks + " click, " + data.impressions + " impr"); await loadGsc(); }
      } catch (e) { toast("Errore: " + e.message, true); }
      finally { btn.disabled = false; btn.textContent = "🔄 Aggiorna ora"; }
    });

    // =============================================
    // CONNECT
    // =============================================
    document.getElementById("btnConnect").addEventListener("click", async () => {
      const rawUrl = document.getElementById("apiUrl").value.replace(/\/$/, "");
      if (!isAllowedApiOrigin(rawUrl)) {
        setStatus(false);
        toast("API URL non consentito: solo HTTPS su " + API_ALLOWED_ORIGINS.join(", "), true);
        return;
      }
      apiUrl = rawUrl;
      adminToken = document.getElementById("adminToken").value;
      try {
        const resp = await fetch(apiUrl + "/health");
        const data = await resp.json();
        if (data.status === "ok") {
          setStatus(true);
          toast("Connesso a " + apiUrl);
          // Auto-load server data
          await loadServerStats();
          await loadServerLicenses();
        } else {
          setStatus(false);
          toast("API non risponde", true);
        }
      } catch(e) {
        setStatus(false);
        toast("Errore: " + e.message, true);
      }
    });

    // =============================================
    // GENERATE
    // =============================================
    document.getElementById("genPlan").addEventListener("change", () => {
      const isLifetime = document.getElementById("genPlan").value === "lifetime";
      document.getElementById("genMonths").disabled = isLifetime;
      if (isLifetime) document.getElementById("genMonths").value = "0";
    });

    document.getElementById("btnGenerate").addEventListener("click", async () => {
      if (!apiUrl || !adminToken) {
        toast("Connettiti prima all'API (inserisci URL e Admin Token)", true);
        return;
      }

      const plan = document.getElementById("genPlan").value;
      const months = parseInt(document.getElementById("genMonths").value) || 1;
      const email = document.getElementById("genEmail").value;
      const devices = parseInt(document.getElementById("genDevices").value) || 3;

      try {
        const resp = await fetch(apiUrl + "/admin/generate-key", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken,
          },
          body: JSON.stringify({ plan, months, email, devices }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Errore server" }));
          toast("Errore: " + (err.error || resp.status), true);
          return;
        }

        const data = await resp.json();
        const { key, raw, plan: respPlan, email: respEmail, expiresHuman } = data;

        // Salva localmente per la tabella
        const lic = {
          key,
          raw,
          plan: respPlan || plan,
          email: respEmail || email,
          expiresHuman: expiresHuman || "—",
          devices,
          created: new Date().toISOString(),
          revoked: false,
        };
        licenses.push(lic);
        saveLocal();
        renderLicenses();
        renderStats();

        // Mostra risultato
        document.getElementById("resultKey").textContent = key;
        document.getElementById("resultRaw").textContent = "Raw: " + (raw || "");
        document.getElementById("resultMeta").textContent =
          "Piano: " + (respPlan || plan) + " | Email: " + (respEmail || email || "—") +
          " | Scadenza: " + (expiresHuman || "—") + " | Max " + devices + " dispositivi";
        document.getElementById("resultBox").classList.add("show");

        toast("License key generata!");
      } catch (e) {
        toast("Errore di rete: " + e.message, true);
      }
    });

    document.getElementById("btnCopy").addEventListener("click", () => {
      const key = document.getElementById("resultKey").textContent;
      navigator.clipboard.writeText(key).then(() => toast("Key copiata!"));
    });

    // =============================================
    // LICENSES TABLE
    // =============================================
    function renderLicenses() { renderLicensesTable(); }

    // =============================================
    // VALIDATE
    // =============================================
    document.getElementById("btnValidate").addEventListener("click", async () => {
      const key = document.getElementById("validateKey").value.trim();
      if (!key) { toast("Inserisci una key", true); return; }

      const resultEl = document.getElementById("validateResult");

      if (apiUrl) {
        try {
          const resp = await fetch(apiUrl + "/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          });
          const data = await resp.json();
          resultEl.innerHTML = `<pre style="color:${data.valid ? '#4ade80' : '#f43f5e'}">${JSON.stringify(data, null, 2)}</pre>`;
          resultEl.classList.add("show");
        } catch(e) {
          resultEl.innerHTML = `<pre style="color:#f43f5e">Errore: ${e.message}</pre>`;
          resultEl.classList.add("show");
        }
      } else {
        // Validazione solo locale
        const found = licenses.find(l => l.raw === key || l.key === key);
        if (found) {
          resultEl.innerHTML = `<pre style="color:${found.revoked ? '#f43f5e' : '#4ade80'}">${JSON.stringify(found, null, 2)}</pre>`;
        } else {
          resultEl.innerHTML = `<pre style="color:#f43f5e">Key non trovata nel database locale</pre>`;
        }
        resultEl.classList.add("show");
      }
    });

    // =============================================
    // STATS (server-first, local fallback)
    // =============================================
    let serverStats = null;

    async function loadServerStats() {
      if (!apiUrl || !adminToken) return;
      try {
        const resp = await fetch(apiUrl + "/admin/stats", {
          headers: { "X-Admin-Token": adminToken },
        });
        if (resp.ok) {
          serverStats = await resp.json();
          renderStats();
        }
      } catch(_) {}
    }

    function renderStats() {
      if (serverStats && serverStats.ok) {
        const s = serverStats;
        document.getElementById("statTotal").textContent = s.licenses.total;
        document.getElementById("statActive").textContent = s.licenses.active;
        document.getElementById("statLifetime").textContent = s.licenses.lifetime;
        document.getElementById("statRevoked").textContent = s.licenses.revoked;
      } else {
        document.getElementById("statTotal").textContent = licenses.length;
        document.getElementById("statActive").textContent = licenses.filter(l => !l.revoked).length;
        document.getElementById("statLifetime").textContent = licenses.filter(l => l.plan === "lifetime").length;
        document.getElementById("statRevoked").textContent = licenses.filter(l => l.revoked).length;
      }
    }

    // =============================================
    // SERVER LICENSES
    // =============================================
    let serverLicenses = null;

    async function loadServerLicenses() {
      if (!apiUrl || !adminToken) return;
      try {
        const resp = await fetch(apiUrl + "/admin/licenses?limit=200", {
          headers: { "X-Admin-Token": adminToken },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.ok) {
            serverLicenses = data.licenses;
            renderLicenses();
          }
        }
      } catch(_) {}
    }

    // =============================================
    // SELECTION STATE
    // =============================================
    let selectedKeys = new Set();

    function getFilteredSource() {
      const source = serverLicenses || licenses;
      const search = (document.getElementById("filterSearch")?.value || "").toLowerCase();
      const planFilter = document.getElementById("filterPlan")?.value || "";
      const statusFilter = document.getElementById("filterStatus")?.value || "";

      return source.filter(lic => {
        const licKey = (lic.key || "").toLowerCase();
        const licEmail = (lic.email || "").toLowerCase();
        const licRaw = (lic.raw || "").toLowerCase();
        const licStatus = lic.status || (lic.revoked ? "revoked" : "active");
        const licPlan = lic.plan || "Free";

        if (search && !licKey.includes(search) && !licEmail.includes(search) && !licRaw.includes(search)) return false;
        if (planFilter && licPlan !== planFilter) return false;
        if (statusFilter && licStatus !== statusFilter) return false;
        return true;
      });
    }

    function updateBulkBar() {
      const bar = document.getElementById("bulkBar");
      const count = selectedKeys.size;
      document.getElementById("bulkCount").textContent = count;
      bar.classList.toggle("show", count > 0);
    }

    // Checkbox selezione: change delegato (le checkbox sono rigenerate a ogni render)
    document.getElementById("licensesBody").addEventListener("change", e => {
      if (e.target.dataset && e.target.dataset.role === "select") {
        if (e.target.checked) selectedKeys.add(e.target.dataset.licKey);
        else selectedKeys.delete(e.target.dataset.licKey);
        syncSelectAllState();
        updateBulkBar();
      }
    });
    function syncSelectAllState() {
      const filtered = getFilteredSource();
      const allSelected = filtered.length > 0 && filtered.every(lic => selectedKeys.has(lic.key || lic.raw || ""));
      const selectAllCb = document.getElementById("selectAll");
      if (selectAllCb) selectAllCb.checked = allSelected;
    }

    function toggleSelectAll(cb) {
      const filtered = getFilteredSource();
      if (cb.checked) {
        filtered.forEach(lic => {
          const k = lic.key || lic.raw || "";
          if (k) selectedKeys.add(k);
        });
      } else {
        selectedKeys.clear();
      }
      syncSelectAllState();
      updateBulkBar();
    }

    function clearSelection() {
      selectedKeys.clear();
      const selectAllCb = document.getElementById("selectAll");
      if (selectAllCb) selectAllCb.checked = false;
      renderLicenses();
      updateBulkBar();
    }

    async function bulkAction(action) {
      if (selectedKeys.size === 0) return;
      if (!apiUrl || !adminToken) { toast("Non connesso", true); return; }

      const keys = [...selectedKeys];
      const label = action === "delete" ? "ELIMINARE DEFINITIVAMENTE" : "REVOCARE";
      if (!confirm(`${label} ${keys.length} licenze?`)) return;
      if (action === "delete" && !confirm("Conferma: le licenze verranno cancellate gratis per tutti.")) return;

      const endpoint = action === "delete" ? "/admin/delete-license" : "/revoke";
      let ok = 0, fail = 0;

      for (const key of keys) {
        try {
          const resp = await fetch(apiUrl + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
            body: JSON.stringify({ key }),
          });
          const data = await resp.json();
          if (data.ok) ok++; else fail++;
        } catch(_) { fail++; }
      }

      selectedKeys.clear();
      const selectAllCb = document.getElementById("selectAll");
      if (selectAllCb) selectAllCb.checked = false;
      updateBulkBar();

      toast(`${ok} ${action === "delete" ? "eliminate" : "revocate"}, ${fail} errori`);
      await loadServerLicenses();
      await loadServerStats();
    }

    // =============================================
    // FILTERS
    // =============================================
    ["filterSearch", "filterPlan", "filterStatus"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(id === "filterSearch" ? "input" : "change", () => renderLicenses());
    });

    function renderLicensesTable() {
      const filtered = getFilteredSource();
      const tbody = document.getElementById("licensesBody");

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nessuna licenza trovata.</td></tr>';
        return;
      }

      // Righe via DOM API: textContent per i dati, dataset per le chiavi → zero innerHTML con dati API
      const frag = document.createDocumentFragment();
      for (const lic of filtered) {
        const plan = lic.plan || "Free";
        const status = lic.status || (lic.revoked ? "revoked" : "active");
        const licKey = lic.key || lic.raw || "";

        const tr = document.createElement("tr");

        const tdCheck = document.createElement("td");
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.className = "lic-checkbox";
        cb.checked = selectedKeys.has(licKey);
        cb.dataset.licKey = licKey; cb.dataset.role = "select";
        tdCheck.appendChild(cb); tr.appendChild(tdCheck);

        const tdKey = document.createElement("td");
        tdKey.style.cssText = "font-family:monospace;font-size:12px;";
        tdKey.textContent = lic.key || "—"; tr.appendChild(tdKey);

        const tdEmail = document.createElement("td");
        tdEmail.textContent = lic.email || "—"; tr.appendChild(tdEmail);

        const tdPlan = document.createElement("td");
        tdPlan.innerHTML = plan === "lifetime"
          ? '<span class="badge badge-lifetime" data-i18n="panel.lifetime">LIFETIME</span>'
          : '<span class="badge badge-Free" data-i18n="panel.pro">Free</span>';
        tr.appendChild(tdPlan);

        const tdExp = document.createElement("td");
        tdExp.textContent = lic.expiresHuman || (lic.expires ? new Date(lic.expires * 1000).toISOString().slice(0, 10) : "LIFETIME");
        tr.appendChild(tdExp);

        const tdDev = document.createElement("td");
        tdDev.textContent = typeof lic.devices === "number" ? lic.devices + "/" + (lic.maxDevices || 3) : (lic.devices || "0") + "/3";
        tr.appendChild(tdDev);

        const tdStat = document.createElement("td");
        const stMap = { revoked: ["badge-revoked", "REVOCATA"], expired: ["badge-revoked", "SCADUTA"] };
        const [stCls, stTxt] = stMap[status] || ["badge-active", "ATTIVA"];
        tdStat.innerHTML = `<span class="badge ${stCls}">${stTxt}</span>`;
        tr.appendChild(tdStat);

        const tdAct = document.createElement("td");
        tdAct.style.whiteSpace = "nowrap";
        const mkBtn = (cls, title, ch, action) => {
          const b = document.createElement("button");
          b.className = "action-btn " + cls; b.title = title; b.textContent = ch;
          b.dataset.licAction = action; b.dataset.licKey = licKey;
          return b;
        };
        if (status !== "revoked") tdAct.appendChild(mkBtn("revoke", "Revoca", "\u23F8", "revoke"));
        tdAct.appendChild(mkBtn("edit", "Modifica", "\u270F", "edit"));
        tdAct.appendChild(mkBtn("delete", "Elimina definitivamente", "\u2716", "del"));
        tr.appendChild(tdAct);

        frag.appendChild(tr);
      }
      tbody.innerHTML = "";
      tbody.appendChild(frag);
    }

    // =============================================
    // SINGLE ACTIONS
    // =============================================
    async function revokeServerLicense(licKey) {
      if (!confirm("Revocare (disabilitare) questa licenza?")) return;
      if (!apiUrl || !adminToken) { toast("Non connesso", true); return; }

      try {
        const resp = await fetch(apiUrl + "/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
          body: JSON.stringify({ key: licKey }),
        });
        const data = await resp.json();
        if (data.ok) {
          toast("Licenza revocata!");
          await loadServerLicenses();
          await loadServerStats();
        } else {
          toast("Errore: " + (data.error || "unknown"), true);
        }
      } catch(e) {
        toast("Errore: " + e.message, true);
      }
    };

    async function deleteServerLicense(licKey) {
      if (!confirm("ELIMINARE DEFINITIVAMENTE questa licenza?\nL'azione e' irreversibile!")) return;
      if (!apiUrl || !adminToken) { toast("Non connesso", true); return; }

      try {
        const resp = await fetch(apiUrl + "/admin/delete-license", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
          body: JSON.stringify({ key: licKey }),
        });
        const data = await resp.json();
        if (data.ok) {
          toast("Licenza eliminata definitivamente!");
          await loadServerLicenses();
          await loadServerStats();
        } else {
          toast("Errore: " + (data.error || "unknown"), true);
        }
      } catch(e) {
        toast("Errore: " + e.message, true);
      }
    };

    function editServerLicense(licKey) {
      toast("Funzione modifica in sviluppo", true);
    };

    // =============================================
    // RETENTION
    // =============================================
    async function loadRetention() {
      const container = document.getElementById("retentionKpis");
      if (!container) return;
      container.innerHTML = '<div class="retention-loader">⏳ Caricamento...</div>';

      try {
        const res = await fetch(apiUrl + "/admin/retention", {
          headers: { "X-Admin-Token": adminToken }
        });
        const data = await res.json();
        if (!data.ok) { container.innerHTML = '<div class="retention-loader">Errore: ' + (data.error || '?') + '</div>'; return; }

        const { summary, retentionCurve, dailyTrend, bySource, byBrowser, byPlan, byReason, byCountry } = data;

        // KPI
        document.getElementById("rTotalInstalls").textContent = fmt(summary.totalInstalls);
        document.getElementById("rActiveDevices").textContent = fmt(summary.activeDevices);
        document.getElementById("rActive7d").textContent = fmt(summary.activeLast7d);
        document.getElementById("rUninstalls").textContent = fmt(summary.totalUninstalls);
        document.getElementById("rUninstallRate").textContent = summary.uninstallRate + "% uninstall";
        document.getElementById("rAvgDays").textContent = summary.avgDaysToUninstall != null ? summary.avgDaysToUninstall + "gg media vita" : "—";
        // Free count (da byPlan)
        const FREERow = byPlan.find(r => r.plan === "Free");
        document.getElementById("rFREECount").textContent = FREERow ? fmt(FREERow.installs) : "0";

        // Retention curve chart
        renderRetentionCurve(retentionCurve || []);

        // Daily trend
        renderDailyTrend(dailyTrend || []);

        // Tables
        fillRetTable("bySourceTable", bySource || [], ["source", "installs", "uninstalls"], true);
        fillRetTable("byBrowserTable", byBrowser || [], ["browser", "installs", "uninstalls"], true);
        fillRetTable("byPlanTable", byPlan || [], ["plan", "installs", "uninstalls"], true);
        fillReasonTable(byReason || []);
        fillRetTable("byCountryTable", byCountry || [], ["country", "installs", "uninstalls"], true);

      } catch (e) {
        container.innerHTML = '<div class="retention-loader">❌ Errore: ' + e.message + '</div>';
      }
    }

    function renderRetentionCurve(curve) {
      const el = document.getElementById("retentionCurveChart");
      if (!el) return;
      if (!curve.length) { el.innerHTML = '<div style="color:#8a8aaa;font-size:0.85rem">Dati non disponibili</div>'; return; }

      const rows = curve.map(c => {
        const pct = c.rate;
        const barW = c.installed > 0 ? Math.round((c.active / c.installed) * 100) : 0;
        return `<tr>
          <td>${c.days}g</td>
          <td class="num">${fmt(c.installed)}</td>
          <td class="num">${fmt(c.active)}</td>
          <td class="num">${pct}%</td>
          <td>
            <div class="rate-bar">
              <div class="rate-bar-inner" style="width:${Math.max(barW, 2)}px"></div>
              <span class="rate-bar-pct">${pct}%</span>
            </div>
          </td>
        </tr>`;
      }).join("");
      el.innerHTML = `<table class="retention-table">
        <thead><tr><th>Giorni</th><th class="num">Installati</th><th class="num">Attivi</th><th class="num">Retention</th><th>Trend</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    function renderDailyTrend(days) {
      const svg = document.getElementById("dailyTrendChart");
      if (!svg || !days.length) return;

      const W = 600, H = 80, PAD = 4;
      const installs = days.map(d => d.installs);
      const maxV = Math.max(...installs, 1);
      const xStep = (W - PAD * 2) / Math.max(days.length - 1, 1);

      const pts = days.map((d, i) => [
        PAD + i * xStep,
        PAD + (H - PAD * 2) - ((d.installs / maxV) * (H - PAD * 2))
      ]);

      const polyline = pts.map(p => p.join(",")).join(" ");
      const area = [pts[0].join(" "), ...pts.map(p => p.join(" ")), `${pts[pts.length-1][0]},${H - PAD}`, `${PAD},${H - PAD}`].join(" ");

      svg.innerHTML = `
        <defs>
          <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#7c5cfc" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#7c5cfc" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon class="area" points="${area}" fill="url(#gradArea)"/>
        <polyline class="line" points="${polyline}"/>
        ${pts.map((p, i) => `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="2"/>`).join("")}
      `;
    }

    function fillRetTable(tbodyId, rows, cols, showRate) {
      const tbody = document.querySelector(`#${tbodyId} tbody`);
      if (!tbody) return;

      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" style="color:#5a5a7a;text-align:center;padding:16px;">Nessun dato</td></tr>'; return; }

      tbody.innerHTML = rows.map(r => {
        const rate = r.installs > 0 ? Math.round((r.uninstalls / r.installs) * 100) : 0;
        const barW = Math.round((r.uninstalls / Math.max(r.installs, 1)) * 80);
        const cells = cols.map(c => {
          if (c === "installs" || c === "uninstalls") return `<td class="num">${fmt(r[c])}</td>`;
          if (c === "country") return `<td>🌍 ${r[c] || "—"}</td>`;
          if (c === "browser") return `<td>${browserIcon(r[c])}</td>`;
          if (c === "plan") return `<td>${planLabel(r[c])}</td>`;
          if (c === "source") return `<td>${r[c] || "—"}</td>`;
          return `<td>${r[c] || "—"}</td>`;
        }).join("");
        const rateCell = showRate ? `
          <td>
            <div class="rate-bar">
              <div class="rate-bar-inner" style="width:${Math.max(barW, 2)}px;background:${rate > 50 ? '#f43f5e' : '#7c5cfc'}"></div>
              <span class="rate-bar-pct">${rate}%</span>
            </div>
          </td>` : "";
        return `<tr>${cells}${rateCell}</tr>`;
      }).join("");
    }

    function fillReasonTable(reasons) {
      const tbody = document.querySelector("#byReasonTable tbody");
      if (!tbody) return;
      if (!reasons.length) { tbody.innerHTML = '<tr><td colspan="3" style="color:#5a5a7a;text-align:center;padding:16px;">Nessun dato</td></tr>'; return; }
      const total = reasons.reduce((s, r) => s + (r.n || 0), 0);
      const labels = {
        broken_site: "🧩 Sito rotto",
        ads_visible: "👀 Ads visibili",
        confusing: "😕 Confusione Free/Free",
        performance: "🐌 Performance",
        found_better: "🔀 Altro prodotto",
        other: "❔ Altro"
      };
      tbody.innerHTML = reasons.map(r => {
        const pct = total > 0 ? Math.round(((r.n || 0) / total) * 100) : 0;
        return `<tr>
          <td>${labels[r.reason] || r.reason || "—"}</td>
          <td class="num">${fmt(r.n)}</td>
          <td class="num">${pct}%</td>
        </tr>`;
      }).join("");
    }

    function browserIcon(b) {
      const m = { chrome: "🌐 Chrome", firefox: "🦊 Firefox", safari: "🧭 Safari", edge: "🔷 Edge", opera: "🔴 Opera" };
      return m[b] || b || "—";
    }
    function planLabel(p) {
      const m = { free: "🆓 Free", Free: "⏳ Free", Free: "💎 Free" };
      return m[p] || p || "—";
    }
    function fmt(n) {
      if (n == null || isNaN(n)) return "—";
      return n.toLocaleString("it-IT");
    }

    // =============================================
    // STATIC BUTTONS (no inline handlers: CSP script-src 'self')
    // =============================================
    document.getElementById("btnRefreshLicenses").addEventListener("click", () => loadServerLicenses());
    document.getElementById("btnBulkRevoke").addEventListener("click", () => bulkAction("revoke"));
    document.getElementById("btnBulkDelete").addEventListener("click", () => bulkAction("delete"));
    document.getElementById("btnBulkClear").addEventListener("click", () => clearSelection());
    document.getElementById("selectAll").addEventListener("change", e => toggleSelectAll(e.target));

    // Delegazione click sulla tabella licenze: i bottoni azione portano data-lic-key / data-action
    document.getElementById("licensesBody").addEventListener("click", e => {
      const btn = e.target.closest("[data-lic-action]");
      if (!btn) return;
      const fn = { revoke: revokeServerLicense, del: deleteServerLicense, edit: editServerLicense }[btn.dataset.licAction];
      if (fn) fn(btn.dataset.licKey);
    });

    // =============================================
    // INIT
    // =============================================
    loadLocal();
    renderLicenses();
    renderStats();
    setStatus(false);
  