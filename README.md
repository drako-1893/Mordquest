# Assoku

En Windows, abre [Iniciar Assoku.cmd](Iniciar%20Assoku.cmd) con doble clic para iniciar el servidor local. Para detenerlo, presiona Ctrl+C en la ventana del servidor.

Ejecuta estos comandos desde la raíz del proyecto con Python 3.10 o superior.

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend:app
```

Abre [la selección de niveles](http://127.0.0.1:8000/levels). Puedes jugar como invitado o crear una cuenta con un usuario y una contraseña. El catálogo permite ocultar niveles resueltos y cambiar el orden.

En la partida, mantén pulsado **Borrar** o usa **Mayús + Intro** sobre el botón para reiniciar el tablero. Se retiran todas las fichas, notas y marcas. **Deshacer** recupera el estado anterior.

En cada arranque se asegura que exista la cuenta `admin` con contraseña `admin`. Si defines `GAME_ADMIN_PASSWORD`, el servidor aplica ese valor al arrancar y conserva el perfil y progreso de la cuenta. La cuenta tiene el rol de administrador y acceso al catálogo de **Recursos**.

- Como invitado, los niveles completados se guardan en el almacenamiento local del navegador. Si borras los datos del sitio, se pierde ese progreso.
- Al iniciar sesión o registrar una cuenta, los niveles completados como invitado se combinan con el progreso de la cuenta. Puedes continuar con esa cuenta desde otro navegador que acceda al mismo servidor.
- SQLite guarda las cuentas, las sesiones y el progreso en `game.sqlite3` en la raíz del proyecto. Puedes cambiar la ruta con `GAME_DATABASE`. Las rutas relativas parten de la raíz del proyecto, desde cualquier carpeta de arranque.
- Al abrir un caso resuelto, el tablero muestra sus posiciones en modo de lectura. «Volver a jugar» inicia un intento con tablero y tiempo en cero y conserva el logro del caso. Puedes retomar el intento desde el catálogo. El contador se conserva por nivel y perfil en el navegador y solo avanza con el tablero activo.

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

`/` lleva a la selección de niveles. Las páginas `/levels`, `/level/la-postal-sin-sello/` y `/resources` comparten `web/templates/layout.html`. Cada vista en `web/templates/pages/` declara su estructura y sus espacios `$nombre`. La ruta correspondiente en `app/pages.py` asigna esos espacios a fragmentos de `web/templates/components/`. El servidor entrega el HTML compuesto y el navegador carga el módulo de entrada con sus importaciones de JavaScript. No hay un paso de compilación del frontend.

Para cambiar una parte de la interfaz, edita su fragmento. Por ejemplo, el cuadro de bienvenida se reutiliza en la selección y la partida desde `components/shared/session_dialogs.html`, y el plano se define en `components/game/board.html`. Para añadir una página, crea su vista y su archivo de entrada con el mismo nombre, registra la ruta y pasa a `render_page` sus componentes y estilos.

La sección `floorTextures` del catálogo registra los materiales y sus colores base. Los tableros toman el tono de cada sala del nivel y Recursos usa el color base de cada material. Ambos aplican la misma paleta. [Catálogo de escenografía](web/static/data/scenery.json)

El brillo (`--floor-lift`) y la intensidad del color (`--floor-chroma`) se ajustan en un solo lugar para los niveles, el tutorial, la solución y Recursos. La visibilidad de las texturas usa `--floor-texture-strength`, con un valor propio para distinguir las ondas del agua. [Estilos compartidos de escenografía](web/static/css/scenery.css)

## Niveles y tipos

Los casos clásicos están en `levels/clasico/`. El catálogo los descubre y valida al arrancar. Para añadir otro, guarda un JSON en la carpeta correspondiente, con el campo `type` igual al nombre de la carpeta, un `id` igual al nombre del archivo y un `order` único en el catálogo. El `id` identifica las partidas guardadas, el progreso y la dirección permanente `/level/{id}/`. El enlace anterior `/index.html?nivel={id}` redirige a esta dirección.

`APP_VERSION` en `app/config.py` indica la versión de Assoku. Actualízala en cada publicación y escribe ese valor en `release` para los niveles nuevos. `release` es la versión en que apareció cada nivel y se muestra en su tarjeta. El catálogo inicial se identifica con `1.0.0`.

Asigna `order` de Muy fácil a Experto y, dentro de cada dificultad, de la versión más reciente a la más antigua. Conserva la secuencia de los casos que comparten dificultad y versión. El número define la secuencia de «Siguiente nivel». Por compatibilidad, `/level/{order}/` redirige al caso que actualmente ocupa ese número y la API todavía acepta el número. Para compartir un caso, usa su dirección permanente.

`GET /api/levels` devuelve el catálogo completo. `GET /api/levels?type=clasico` permite consultar un tipo concreto. La selección muestra el catálogo completo. Crear otra carpeta y asignar un nuevo `type` permite clasificar niveles que usan las mismas reglas. Una modalidad con reglas o tablero diferentes requiere ampliar el modelo y la validación en `app/levels/`, además del controlador de partida en `web/static/js/game/`.

Los JSON de autoría se leen solo desde el servidor. La API sirve los datos públicos del tablero y compara las posiciones en el servidor. La partida solicita las tarjetas solo al abrir **Ver solución paso a paso**, mediante `GET /api/levels/{id}/walkthrough`.

Antes de publicar un nivel, ejecuta `python -m app.levels.walkthrough`. El verificador aplica deducciones directas a las pistas y las reglas hasta que solo queda una casilla por persona. Si el recorrido se atasca, revisa las pistas. FastAPI ejecuta la misma verificación al arrancar y genera las tarjetas. Si editas un nivel, vuelve a ejecutar la verificación y reinicia el servidor para cargar la revisión.

Una pista «al lado» exige que la casilla vecina esté arriba, abajo, a la izquierda o a la derecha, dentro de la misma zona. Si el objeto bloquea la casilla, la pista debe identificarlo. Por ejemplo, `{"kind":"next_to","object":"#","asset":"caja"}` se muestra como «Estaba al lado de una caja» y la zona debe usar `caja` como `obstacle_asset`.

Consulta [LevelCreatorRules.md](LevelCreatorRules.md) para ver las reglas de diseño, el formato JSON y la lista de verificación.

## Verificación local

Desde la raíz del proyecto, con Python 3.10 o superior y Node.js 20 o superior:

```powershell
python -m pip install -r requirements.txt
python -m app.levels.walkthrough
npm ci
npx playwright install chromium
npm test
```

Las pruebas de navegador inician instancias locales con una base SQLite temporal. Si Python no está en el `PATH`, define `ASSOKU_PYTHON` con la ruta del ejecutable. La comprobación de niveles y las pruebas de Chromium también se ejecutan en GitHub Actions.

## Despliegue

`render.yaml` configura el servicio web gratuito **Assoku** y activa el modo invitado con `GAME_GUEST_ONLY=true`. Crea el Blueprint en Render desde la rama que contiene ese archivo.

El progreso y el perfil de invitado se guardan en el navegador para ese sitio. Sobreviven a los reinicios y redespliegues de Render. Si borras los datos del sitio o cambias de navegador, tendrás un historial independiente. Las cuentas y el catálogo privado de recursos están disponibles en el modo local con SQLite.
