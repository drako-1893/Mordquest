# Reglas para crear niveles de Archivo Nocturno

## Tablero y dificultad

| Dificultad | Valor JSON | Tamaño |
| --- | --- | --- |
| Fácil | `easy` | 8 × 8 |
| Medio | `medium` | 12 × 12 |
| Difícil | `hard` | 16 × 16 |
| Experto | `expert` | 20 × 20 |

- Hay tantas personas como filas, con una sola víctima e iniciales únicas de la A a la Z.
- La solución coloca exactamente una persona por fila y columna. Las casillas de obstáculo quedan bloqueadas. La víctima se coloca al final.
- El culpable es la única otra persona que comparte sala con la víctima.
- Diseña una sola solución para todo el tablero. Ajusta la dificultad con la cantidad de alternativas plausibles y los cruces entre pistas, además del tamaño. En los fáciles, deja algunas deducciones que permitan empezar enseguida.

## Salas y objetos

- Cada casilla pertenece a una sola sala. Una sala puede tener forma irregular y todas sus casillas deben estar conectadas por lados. Un contacto en diagonal no conecta dos partes.
- **Elige objetos coherentes con el uso de la sala.** Por ejemplo, una planta en recepción, un globo terráqueo en lectura, macetas en un vivero, pedestales en una galería, máquinas en una sala recreativa y neumáticos o herramientas en un taller.
- Agrupa el mobiliario cerca de los muros o en pequeños conjuntos. Conserva espacios libres y evita llenar pasillos o salas estrechas. Usa texturas de suelo repetibles para dar continuidad visual sin ocupar casillas.
- Da a cada sala un nombre y un color identificables. El nombre se presenta en una línea, con fondo semitransparente y centrado en el borde inferior. Comprueba que el texto se lea y no se superponga con otros nombres en una pantalla estrecha.
- Mantén clara la diferencia entre suelo libre, asiento, alfombra y obstáculo. Un cambio de arte debe respetar el significado de cada casilla y el texto de las pistas.

## Pistas personales

Combina los tipos de pista entre personajes. Usa una sola pista cuando baste en conjunto con las demás. Evita repetir fila más asiento para todos.

| `kind` | Campo | Significado |
| --- | --- | --- |
| `row`, `column` | `number` | Fila o columna, numerada desde 1. |
| `on` | `object` | La persona ocupa una silla (`S`), alfombra (`A`), banco (`B`) o puf (`P`). |
| `next_to` | `object` | Una casilla que comparte un lado contiene el objeto indicado. Admite `S`, `A`, `B`, `P` o un obstáculo (`#`). |
| `room` | `room` | La persona está en la sala con esa letra. |
| `north`, `south`, `east`, `west` | `person` | Inicial de otra persona. Norte y sur comparan filas. Este y oeste comparan columnas. No se exige alineación. |

Ejemplo de una pista relativa: `{"kind":"east","person":"B"}`.

## Reglas generales

- Una regla general se aplica a la colocación completa. Úsala para crear una deducción que cruce varias salas o personas. Si es decisiva para el nivel, comprueba que al quitarla aparezcan alternativas.
- La regla implementada es `seated_exactly`. Por ejemplo, `{"kind":"seated_exactly","count":1}` significa «Solo una persona estaba sentada».
- Cuentan todos los participantes, incluida la víctima. Sentarse significa ocupar una silla, un banco o un puf. Estar sobre una alfombra no cuenta.
- Pon `"rules": []` en un caso sin regla especial. El formato actual admite una regla general por nivel.

## Formato JSON v2

Guarda un archivo `levels/<tipo>/<id>.json` por nivel. Usa minúsculas, números y guiones entre palabras para el tipo y el ID. Evita cambiar el ID de un nivel publicado porque identifica su URL, sus partidas guardadas y el progreso de los jugadores. El cargador también admite el formato anterior `levels/<id>.json` y asigna el tipo `clasico` cuando falta el campo `type`.

| Campo | Regla |
| --- | --- |
| `version` | `2`. |
| `type` | Agrupa el nivel en el catálogo. Usa el mismo nombre que su carpeta, por ejemplo `clasico`. |
| `id`, `order`, `title`, `description` | ID igual al nombre del archivo, orden entero positivo único, título y descripción. |
| `size`, `difficulty`, `cover` | Lado y dificultad según la tabla. Usa una portada SVG existente en `web/resources/`. |
| `theme` | Fondo de la tarjeta. Admite `archive`, `greenhouse`, `museum`, `arcade` o `repair`. Por defecto usa `archive`. |
| `rooms` | Lista de salas con `id` de una letra mayúscula, `name` y `color` hexadecimal de seis dígitos. |
| `rooms[].floor` | `arena`, `piedra`, `cesped`, `madera`, `baldosa` o `asfalto`. |
| `rooms[].obstacle_asset` | Recurso de una casilla que representa todos los `#` de esa sala. Usa uno permitido en `app/levels/models.py`, por ejemplo `maceta-helecho`, `pedestal-busto` o `caja-herramientas`. Por defecto se usa `caja`. |
| `rooms[].rug_asset` | `alfombra`, `alfombra-ondas` o `alfombra-cuadros`. Cambia el arte de las casillas `A`. |
| `room_map` | Una cadena por fila y una letra de sala por casilla. Cada sala declarada se usa al menos una vez. |
| `tiles` | Mapa del mismo tamaño. `.` es suelo libre, `#` es obstáculo, `S` es silla, `A` es alfombra, `B` es banco y `P` es puf. |
| `participants` | Entradas con `name`, `initial`, `color` y al menos una entrada en `clues`. La víctima usa `"clues": null`. |
| `rules` | Lista con la regla general o una lista vacía. |
| `solution` | Mapa privado de inicial a índice de casilla. El índice empieza en 0 y crece de izquierda a derecha fila por fila. Para fila y columna desde 1, usa `(fila - 1) * size + (columna - 1)`. |

## Verificación antes de publicar

1. Reinicia FastAPI y comprueba que el catálogo y el nivel carguen. Si quieres comprobar la clasificación, consulta `/api/levels?type=<tipo>`. El servidor valida tamaños, referencias, conectividad y que la solución guardada cumpla las pistas y reglas.
2. Usa un solucionador o una enumeración de posibilidades para comprobar que la solución sea única. Repite la prueba al cambiar pistas, objetos que bloquean o el mapa de salas. La validación de arranque comprueba la solución registrada.
3. Abre el nivel como jugador y comprueba que se distingan los objetos y las salas. Revisa la navegación en pantallas estrechas.
4. Completa el tablero y pulsa **Comprobar** con la solución válida y con fichas intercambiadas. El resultado debe aceptar la solución y listar las personas mal ubicadas en el desplegable, sin revelar sus casillas correctas.

FastAPI publica el catálogo en `GET /api/levels` y el tablero en `GET /api/levels/{id}`. La solución guardada se usa en `POST /api/levels/{id}/check` y se excluye del tablero público.
