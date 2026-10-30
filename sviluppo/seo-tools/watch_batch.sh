#!/usr/bin/env bash
# Osservatore passivo di sola lettura: avanzamento (content/*.json, target 360)
# + controlli qualità ogni 5 giri. Unico file scritto: progress.log.
# Mai pgrep/pkill; /proc + case, esclude $$.
set -u
DIR="/mnt/nvme2/projects/Progetti/ChromePlugin/sviluppo/seo-tools/streaming-cluster"
LOG="$DIR/finalize.log"; PLOG="$DIR/progress.log"
MAX_ROUNDS=170; STALL_LIMIT=25; TARGET=360; QC_EVERY=5
LANGS="it de es fr pt ru pl tr ja ko zh ar hi id"
BANNED_RE='here is the translation|certainly|sure!|ecco la traduzione'
LAST_FAILS=0; PREV_WORKERS=-1

eta_fmt() { # eta_fmt <minuti_float> -> "1h20m"
    local tot=$(awk -v m="$1" 'BEGIN{printf "%d", m+0.5}')
    printf '%dh%02dm' $((tot/60)) $((tot%60))
}
count_files() { ls "$DIR"/content/*.json 2>/dev/null | wc -l; }

# progress_line <n> <delta> <deltas...>
progress_line() {
    local n=$1 d=$2; shift 2
    local len=$# sum=0 rate="0.0" eta="fermo"
    for c in "$@"; do sum=$((sum + c)); done
    [ "$len" -gt 0 ] && rate=$(awk -v s="$sum" -v l="$len" 'BEGIN{printf "%.1f", s/l}')
    local miss=$((TARGET - n)); [ "$miss" -lt 0 ] && miss=0
    [ "$(awk -v r="$rate" 'BEGIN{print (r>0)?1:0}')" = 1 ] && eta=$(eta_fmt "$(awk -v m="$miss" -v r="$rate" 'BEGIN{print m/r}')")
    printf '%s | file=%d | +%d | ritmo=%s | mancanti=%d | eta=%s\n' \
        "$(date '+%Y-%m-%d %H:%M')" "$n" "$d" "$rate" "$miss" "$eta"
}

# QC a) termini vietati "netflix". Ritorna 1 (esci) se > 5.
qc_banned() {
    local files=$(grep -ril "netflix" "$DIR"/content/ 2>/dev/null)
    local n=$(echo -n "$files" | grep -c .)
    echo "vietati=$n"
    [ "$n" -gt 0 ] && echo "$files" | sed 's/^/  contaminato: /'
    [ "$n" -le 5 ]
}

# QC b) JSON malformati. Ritorna 1 (esci, bloccante) se > 0.
qc_json() {
    local bad
    bad=$(python3 -c '
import glob, json
for f in sorted(glob.glob("'"$DIR"'/content/*.json")):
    try: json.load(open(f))
    except Exception: print(f)')
    local n=$(echo -n "$bad" | grep -c .)
    echo "malformati=$n"
    [ "$n" -eq 0 ] || { echo "$bad" | sed 's/^/  rotto: /'; return 1; }
}

# QC c) residui di prompt (solo segnalazione)
qc_preamble() {
    local files=$(grep -rilE "$BANNED_RE" "$DIR"/content/ 2>/dev/null)
    local n=$(echo -n "$files" | grep -c .)
    echo "preamboli=$n"
    [ "$n" -gt 0 ] && echo "$files" | sed 's/^/  preambolo: /'
    return 0
}

# QC d) copertura per lingua
qc_coverage() {
    local out="copertura:"
    for l in $LANGS; do out="$out $l=$(ls "$DIR"/content/*.$l.json 2>/dev/null | wc -l)"; done
    echo "$out (slug en=$(ls "$DIR"/content/*.en.json 2>/dev/null | wc -l))"
}

# QC e) fallimenti nei worker-*.log e finalize.log
qc_fails() {
    local total prev=$LAST_FAILS
    total=$(grep -h "FAIL" "$DIR"/worker-*.log "$LOG" 2>/dev/null | wc -l)
    LAST_FAILS=$total
    echo "fail=$total"
    if [ "$total" -gt "$prev" ]; then
        grep -h "FAIL" "$DIR"/worker-*.log "$LOG" 2>/dev/null | tail -n 3 | sed 's/^/  fail: /'
    fi
    return 0
}

# QC f) processi translate_cluster vivi (da /proc, no pgrep)
qc_workers() {
    local n=0 langs="" cmd pid
    for p in /proc/[0-9]*; do
        pid="${p#/proc/}"; [ "$pid" = "$$" ] && continue
        cmd=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null) || continue
        case "$cmd" in
            *translate_cluster*)
                n=$((n+1))
                if [[ "$cmd" =~ --langs[=[:space:]]([^[:space:]]+) ]]; then langs+="${BASH_REMATCH[1]} | "; else langs+="? | "; fi ;;
        esac
    done
    echo "worker=$n [${langs% | }]"
    if [ "$PREV_WORKERS" -ge 0 ] && [ "$n" -lt "$PREV_WORKERS" ]; then
        echo "worker terminato: prima=$PREV_WORKERS ora=$n — verifica se quella lingua avanza ancora"
    fi
    PREV_WORKERS=$n
    return 0
}

# Blocco qualità completo. Ritorna 1 = esci.
run_qc() {
    echo "--- qc $(date '+%Y-%m-%d %H:%M')"
    qc_banned || { echo "ESCI: TROPPI FILE CONTAMINATI — cancellare e rigenerare"; return 1; }
    qc_json   || { echo "ESCI: JSON MALFORMATO — bloccante per il bake"; return 1; }
    qc_preamble; qc_coverage; qc_fails; qc_workers
    return 0
}

# Riassunto finale su ogni uscita
final_summary() {
    echo "=== RIEPILOGO USCITA $(date '+%Y-%m-%d %H:%M')"
    echo "file: $(count_files)/$TARGET"
    qc_coverage
    echo "vietati=$(grep -ril "netflix" "$DIR"/content/ 2>/dev/null | wc -l) malformati=vedi-ultimo-qc preamboli=$(grep -rilE "$BANNED_RE" "$DIR"/content/ 2>/dev/null | wc -l) fail=$(grep -h "FAIL" "$DIR"/worker-*.log "$LOG" 2>/dev/null | wc -l)"
    echo "---- progress.log (ultime 15)"
    tail -n 15 "$PLOG" 2>/dev/null
}

deltas=(); prev=$(count_files)
echo "== avvio $(date '+%Y-%m-%d %H:%M') | file iniziali=$prev | target=$TARGET" >> "$PLOG"
stall=0
for i in $(seq 1 "$MAX_ROUNDS"); do
    sleep 60
    n=$(count_files)
    d=$((n - prev)); [ "$d" -lt 0 ] && d=0
    deltas+=("$d"); [ "${#deltas[@]}" -gt 10 ] && deltas=("${deltas[@]: -10}")
    line=$(progress_line "$n" "$d" "${deltas[@]}")
    echo "$line" >> "$PLOG"; echo "$line"
    if [ "$n" -gt "$prev" ]; then stall=0; else stall=$((stall+1)); fi
    prev=$n
    if [ $((i % QC_EVERY)) -eq 0 ] && ! run_qc >> "$PLOG" 2>&1; then
        echo "ESCI a giro $i per qc"; final_summary; exit 1
    fi
    if grep -q "RIEPILOGO FINALE" "$LOG" 2>/dev/null; then
        echo "BATCH CONCLUSO dopo ~$i minuti"; final_summary; exit 0
    fi
    alive=0
    for p in /proc/[0-9]*; do
        pid="${p#/proc/}"; [ "$pid" = "$$" ] && continue
        cmd=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null) || continue
        case "$cmd" in *translate_cluster*|*finalize_cluster*) alive=1; break ;; esac
    done
    if [ "$alive" -eq 0 ]; then
        echo "PIPELINE TERMINATA senza riepilogo dopo ~$i minuti"; final_summary; exit 0
    fi
    if [ "$stall" -ge "$STALL_LIMIT" ]; then
        echo "STALLO: nessun nuovo file da 25 minuti"; final_summary; exit 0
    fi
done
echo "TIMEOUT osservatore"; final_summary; exit 0
