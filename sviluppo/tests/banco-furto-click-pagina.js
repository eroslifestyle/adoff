module.exports = { PAGINA: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Video Player</title>
</head>
<body>
    <div id='lettore' style='width:640px;height:360px;background:#222;position:relative;margin:40px'>
        <button id='btnPlay' style='width:120px;height:40px'>Play</button>
        <button id='btnPausa' style='width:120px;height:40px'>Pausa</button>
        <button id='btnVolume' style='width:120px;height:40px'>Volume</button>
    </div>
    <script>
        window.__stato = { play: false, pausa: false, volume: 1, clickRicevuti: 0, adSparati: 0 };

        document.getElementById('btnPlay').addEventListener('click', function() {
            window.__stato.clickRicevuti++;
            window.__stato.play = true;
        });

        document.getElementById('btnPausa').addEventListener('click', function() {
            window.__stato.clickRicevuti++;
            window.__stato.pausa = true;
        });

        document.getElementById('btnVolume').addEventListener('click', function() {
            window.__stato.clickRicevuti++;
            window.__stato.volume = 0.5;
        });

        var parametri = new URLSearchParams(location.search);
        var tecnica = parametri.get('tecnica') || 'cattura';

        if (tecnica === 'cattura') {
            var gestoreCattura = function(evento) {
                if (evento.isTrusted && window.__stato.adSparati < 2) {
                    window.__stato.adSparati++;
                    window.open('https://esempio-pubblicita-finta.test/pop?zoneid=9305180');
                    evento.stopImmediatePropagation();
                    evento.preventDefault();
                    return;
                }
            };
            document.addEventListener('click', gestoreCattura, true);
            document.addEventListener('pointerdown', gestoreCattura, true);
        }

        if (tecnica === 'ancora') {
            var ancora = document.createElement('a');
            ancora.href = 'https://esempio-pubblicita-finta.test/pop?zoneid=9305180';
            ancora.target = '_blank';
            ancora.style.position = 'absolute';
            ancora.style.left = '0';
            ancora.style.top = '0';
            ancora.style.width = '100%';
            ancora.style.height = '100%';
            ancora.style.opacity = '0.01';
            ancora.style.zIndex = '99999';
            document.getElementById('lettore').appendChild(ancora);
            ancora.addEventListener('click', function() {
                window.__stato.adSparati++;
                ancora.remove();
            });
        }
    </script>
</body>
</html>` };
