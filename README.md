# Archivo Nocturno

En Windows, abre [Iniciar Assoku.cmd](Iniciar%20Assoku.cmd) con doble clic para iniciar el servidor local. Para detenerlo, presiona Ctrl+C en la ventana del servidor.

Ejecuta estos comandos desde la raíz del proyecto con Python 3.10 o superior.

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend:app
```

Abre [la selección de niveles](http://127.0.0.1:8000/niveles.html). Puedes jugar como invitado o crear una cuenta con un usuario y una contraseña.

En la partida, mantén pulsado **Borrar** o usa **Mayús + Intro** sobre el botón para reiniciar el tablero. Se retiran todas las fichas, notas y marcas. **Deshacer** recupera el estado anterior.

En el primer arranque se crea la cuenta de prueba `admin` con contraseña `admin`. Para usar otra contraseña inicial, define `GAME_ADMIN_PASSWORD` antes de iniciar con una base nueva. La cuenta accede al juego con los mismos permisos de las demás cuentas.

- Como invitado, los niveles completados se guardan en el almacenamiento local del navegador. Si borras los datos del sitio, se pierde ese progreso.
- Al iniciar sesión o registrar una cuenta, los niveles completados como invitado se combinan con el progreso de la cuenta. Puedes continuar con esa cuenta desde otro navegador que acceda al mismo servidor.
- SQLite guarda las cuentas, las sesiones y el progreso en `game.sqlite3`. Puedes cambiar la ruta con la variable de entorno `GAME_DATABASE`.
- Al abrir un caso resuelto, el tablero muestra sus posiciones en modo de lectura. «Volver a jugar» permite confirmar el reinicio del tablero y del estado de ese caso.

## Estructura del proyecto

| Ruta | Responsabilidad |
| --- | --- |
| `backend.py`, `app/main.py` | Punto de entrada de Uvicorn, arranque y registro de rutas. |
| `app/levels/` | Modelos y validación, lectura de niveles y API de catálogo, tablero y comprobación. |
| `app/accounts/` | Cuentas, sesiones y sincronización de progreso con SQLite. |
| `app/pages.py`, `web/templates/` | Composición de páginas HTML en el servidor. |
| `web/static/js/pages/` | Un módulo de entrada por página. |
| `web/static/js/game/`, `web/static/js/shared/` | Controlador de partida, tablero y pistas, más módulos compartidos de sesión, progreso y escenografía. |
| `web/static/css/`, `web/resources/` | Estilos compartidos y por pantalla, más los SVG accesibles desde `/Resources/`. |
| `levels/<tipo>/<id>.json` | Un archivo autónomo por nivel, con sus datos, reglas y solución. |

`/` lleva a la selección de niveles. Las páginas `/niveles.html`, `/index.html?nivel=<id>` y `/recursos.html` comparten `web/templates/layout.html`. Cada vista en `web/templates/pages/` declara su estructura y sus espacios `$nombre`. La ruta correspondiente en `app/pages.py` asigna esos espacios a fragmentos de `web/templates/components/`. El servidor entrega el HTML compuesto y el navegador carga el módulo de entrada con sus importaciones de JavaScript. No hay un paso de compilación del frontend.

Para cambiar una parte de la interfaz, edita su fragmento. Por ejemplo, el cuadro de bienvenida se reutiliza en la selección y la partida desde `components/shared/session_dialogs.html`, y el plano se define en `components/game/board.html`. Para añadir una página, crea su vista y su archivo de entrada con el mismo nombre, registra la ruta y pasa a `render_page` sus componentes y estilos.

## Niveles y tipos

Los casos clásicos están en `levels/clasico/`. El catálogo los descubre y valida al arrancar. Para añadir otro, guarda un JSON en la carpeta correspondiente, con el campo `type` igual al nombre de la carpeta, un `id` igual al nombre del archivo y un `order` único en el catálogo. Usa el mismo `id` al mover un caso de tipo para conservar su enlace, sus partidas guardadas y su progreso.

`GET /api/levels` devuelve el catálogo completo. `GET /api/levels?type=clasico` permite consultar un tipo concreto. La selección muestra el catálogo completo. Crear otra carpeta y asignar un nuevo `type` permite clasificar niveles que usan las mismas reglas. Una modalidad con reglas o tablero diferentes requiere ampliar el modelo y la validación en `app/levels/`, además del controlador de partida en `web/static/js/game/`.

Los JSON de autoría se leen solo desde el servidor. La API sirve los datos públicos del tablero y compara las posiciones en el servidor. La partida solicita las tarjetas solo al abrir **Ver solución paso a paso**, mediante `GET /api/levels/{id}/walkthrough`.

Antes de publicar un nivel, ejecuta `python -m app.levels.walkthrough`. El verificador deduce las posiciones a partir de las pistas y las reglas, descarta alternativas por contradicción y confirma que la solución única coincide con el JSON. FastAPI ejecuta la misma verificación al arrancar y genera las tarjetas. Si editas un nivel, vuelve a ejecutar la verificación y reinicia el servidor para cargar la revisión.

Una pista «al lado» exige que la casilla vecina esté arriba, abajo, a la izquierda o a la derecha, dentro de la misma zona. Si el objeto bloquea la casilla, la pista debe identificarlo. Por ejemplo, `{"kind":"next_to","object":"#","asset":"caja"}` se muestra como «Estaba al lado de una caja» y la zona debe usar `caja` como `obstacle_asset`.

Consulta [LevelCreatorRules.md](LevelCreatorRules.md) para ver las reglas de diseño, el formato JSON y la lista de verificación.

## Despliegue

`render.yaml` conserva el arranque con `backend:app` y comprueba `/api/levels`. En el servicio gratuito de Render, SQLite usa almacenamiento temporal y los datos pueden perderse al reiniciar o volver a desplegar el servicio.
