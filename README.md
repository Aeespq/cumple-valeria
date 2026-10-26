# Cumple de Valeria

Sorpresa interactiva de cumpleaños: un regalo que se abre, una tarta con velas
que se apagan manteniendo pulsado y una tarjeta final con dedicatoria. Sin
dependencias ni build; solo HTML, CSS y JavaScript.

## Ver en local

```sh
python3 -m http.server 8765
```

Abre <http://127.0.0.1:8765/>.

## Cambiar el contenido

- **Nombre y textos de las escenas**: `index.html` (busca `Valeria` y el bloque
  `card__text`).
- **Dedicatoria y firma**: dentro de `<article class="card">` en `index.html`.
- **Colores**: variables al principio de `styles.css` (`:root`).
- **Música**: melodía definida en `script.js`, en los arrays `ARP` y `BASS`
  (notas MIDI y tiempos en beats).
- **Duración de cada vela**: constante `HOLD_PER_CANDLE` en `script.js`.

## Probar estados concretos

- `/?escena=tarta` — salta a la tarta.
- `/?escena=tarjeta` — salta a la tarjeta final.
- `/?estatico=1` — desactiva animaciones (útil para capturas).

## Publicar

El sitio se sirve desde la rama `main` con GitHub Pages:

<https://Aeespq.github.io/cumple-valeria/>

Para actualizarlo:

```sh
git add -A
git commit -m "feat: actualiza la dedicatoria"
git push
```

GitHub Pages tarda alrededor de un minuto en reflejar el cambio.

## Detalles

- La música no suena hasta el primer toque (política de autoplay del navegador).
- Botón arriba a la derecha para silenciar.
- Respeta `prefers-reduced-motion` y funciona con teclado.
