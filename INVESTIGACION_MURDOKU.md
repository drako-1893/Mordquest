# Investigación de Murdoku

Consulta realizada el **24 de noviembre de 2026**. Incluye las reglas de los libros, los recursos oficiales y el análisis del HTML de la beta web incluido en el proyecto.

El nombre oficial es **Murdoku**. Manuel Garand lo creó en 2020 y publicó sus primeros casos como imprimibles gratuitos. El primer libro salió en 2025. La mecánica central consiste en reconstruir la posición exacta de cada persona en un plano y deducir quién estaba a solas con la víctima. [Historia del autor](https://murdoku.com/es/about) · [Ficha del primer libro](https://www.planetadelibros.com/libro-murdoku-80-acertijos-de-logica-y-asesinatos/426932)

## 1. Reglas del juego

### Reglas base

| Regla | Aplicación |
| --- | --- |
| Ubicación de cada persona | Cada personaje, incluida la víctima, ocupa exactamente una casilla permitida. Dos personas no pueden compartir casilla. |
| Filas y columnas | Puede haber como máximo una persona en cada fila y en cada columna de toda la cuadrícula. Las paredes no reinician ese conteo. En un caso de N × N con N personas, necesariamente se ocupa una casilla por fila y por columna. |
| Zonas | Las paredes delimitan habitaciones u otras áreas identificadas en el plano. Una zona puede contener varias personas si sus casillas respetan la restricción de filas y columnas y las pistas del caso. |
| Casillas y objetos | La leyenda determina qué se puede ocupar. En el imprimible *The Courtroom*, las sillas y alfombras se pueden ocupar y las mesas, televisores, estanterías y plantas bloquean sus casillas. Un objeto bloqueante puede servir de referencia para una pista. |
| «Junto a» | Significa una casilla inmediatamente a la izquierda, derecha, arriba o abajo del objeto, dentro de la misma zona. Se excluyen diagonales y vecinos al otro lado de una pared. Si el objeto ocupa varias casillas, sus casillas forman el conjunto de referencia. |
| «Con» y «a solas con» | «Con» indica que las personas comparten zona. «A solas con» exige, además, que no haya una tercera persona en esa zona. En el formato clásico de asesinato, el culpable es la única persona que comparte zona con la víctima. Pueden estar en extremos distintos de esa zona. |

[Reglas y leyenda de The Courtroom](https://murdoku.com/pdf/the-courtroom-bw.pdf) · [Ejemplo de objetos de varias casillas en The Zoo](https://murdoku.com/pdf/the-zoo-bw.pdf)

### Cómo se resuelve un caso

1. Leer la premisa, las reglas especiales, la leyenda y las pistas individuales. Identificar a la víctima.
2. Identificar casillas candidatas a partir de las pistas directas, como una zona concreta, una silla o la fila superior. Aplicar también las negaciones de las pistas.
3. Cuando una persona solo pueda ocupar una casilla, fijarla y descartar las demás casillas de su fila y columna para cualquier otra persona. Si varias candidatas comparten una fila, también se puede reservar la fila para esa persona antes de saber la columna.
4. Cruzar las pistas que dependen de otras personas o zonas. La solución publicada de *The Courtroom* muestra cómo una restricción de compañía permite reducir candidatas antes de fijar ambas posiciones.
5. Verificar todas las posiciones y determinar quién quedó a solas con la víctima. Algunos casos de iniciación del libro indican que la víctima ocupa la última casilla disponible. Esa pista pertenece a esos casos.

[Ejemplo resuelto paso a paso, con spoilers](https://murdoku.com/pdf/the-courtroom-solution.pdf) · [Fragmento en español del volumen 1](https://pdlibroscol.cdnstatics2.com/usuaris/libros_contenido/arxius/63/62227_Murdoku.pdf)

### Variantes y casos avanzados

- Las pistas pueden combinar pertenencia a una zona, ocupación o cercanía a un objeto, distancia en filas o columnas, negaciones y conteos. Además de las pistas individuales, un caso puede declarar grupos de personas o condiciones globales. En *The Zoo*, por ejemplo, cada hábitat exige al menos un cuidador y solo los cuidadores pueden estar en ellos. [Caso experto imprimible](https://murdoku.com/pdf/the-zoo-bw.pdf)
- Las reglas especiales pueden cambiar las premisas de un caso. La fe de erratas del volumen 2 menciona un acertijo con una fila vacía. Conviene leer las instrucciones de cada caso antes de inferir cuántas filas y columnas se ocupan. [Fe de erratas oficial](https://murdoku.com/es/errata)
- El tercer volumen incorpora investigaciones que transcurren en varias cuadrículas. *Family Murdoku* también contiene casos con otro criterio para identificar al culpable. En *The Cookie Thief* se busca a quien ocupa la casilla de las migas. [Catálogo oficial de libros](https://murdoku.com/es/book) · [The Cookie Thief](https://murdoku.com/pdf/the-cookie-thief-bw.pdf)

## 2. Recursos del juego

| Recurso | Qué aporta |
| --- | --- |
| [Sitio oficial](https://murdoku.com/es/) y [juego web](https://murdoku.com/play/?lang=es) | Casos gratuitos en el navegador. El sitio anuncia un caso nuevo cada semana. |
| [Casos imprimibles](https://murdoku.com/es/print) | Doce casos clásicos entre 6×6 y 16×16, con versiones en color, blanco y negro y soluciones por separado. La misma página reúne los casos familiares. |
| [Murdoku, volumen 1](https://www.planetadelibros.com/libro-murdoku-80-acertijos-de-logica-y-asesinatos/426932) | 80 casos de dificultad progresiva. El formato típico reúne fichas de personajes, plano ilustrado y solución detallada al final. El fragmento editorial muestra los primeros casos y ejemplos de cuadrículas auxiliares para tomar notas. |
| [Viaje al pasado, volumen 2](https://www.planetadelibros.com/libro-murdoku-viaje-al-pasado/456619) | 80 casos en cinco épocas, con nuevas reglas particulares sobre la misma base de deducción. |
| [Vuelta al mundo, volumen 3](https://www.planetadelibros.com/libro-murdoku-vuelta-al-mundo/467281) | Investigar en varios planos dentro de un mismo caso es una novedad del volumen. La edición española está anunciada para febrero de 2027. |
| [Correcciones oficiales por edición](https://murdoku.com/es/errata) | Aclaran ambigüedades de redacción y traducción, errores de dirección o distancia y excepciones de ocupación. Sirven de referencia para redactar y revisar pistas propias. |
| [HTML aportado al proyecto](MordokuPage%20Html.txt) | Captura del DOM de la beta. Permite inspeccionar la estructura del caso, las herramientas presentes y los recursos gráficos que referencia. |

Una buena secuencia de estudio es comparar un imprimible fácil con su solución explicada, revisar cómo el libro presenta un caso inicial y usar el HTML para entender la presentación digital de un caso experto. La página oficial identifica **Murdoku** como marca de Digivoid Studios Inc. Para el proyecto, la mecánica puede servir de referencia para un juego con identidad, casos, textos, planos y arte propios. [Catálogo oficial](https://murdoku.com/es/book) · [Sitio oficial y créditos](https://murdoku.com/es/)

## 3. Cómo está implementada la beta web

### Qué contiene la captura

El HTML corresponde a **El despacho del director general**, un caso experto de **16×16** con **256 casillas** y **16 personajes en total**, incluida la víctima. La metadescripción anuncia «16 suspects», pero el recuento de fichas incluye a la víctima. La captura contiene los 16 personajes colocados, el cartel **CASO RESUELTO** y el botón **Jugar de nuevo**. Las herramientas de edición y envío aparecen deshabilitadas en ese estado. [HTML local](MordokuPage%20Html.txt) · [Página del caso](https://murdoku.com/play/puzzle-the-ceos-office-expert)

| Área | Evidencia en el HTML |
| --- | --- |
| Panel izquierdo | Título, selector con 23 opciones de idioma, reglas generales del caso y 16 fichas con retrato, nombre y pista. Las palabras y relaciones relevantes van en negrita. Las pistas y los retratos son elementos de botón. |
| Tablero central | CSS Grid con 16 filas y 16 columnas de 50 px antes del escalado. Cada casilla se identifica con `data-cell-index`. Los 512 atributos corresponden a 256 índices distintos, repetidos en dos elementos por índice. Las zonas tienen rótulos y paredes. El tablero combina casillas HTML, tres capas de canvas, SVG e imágenes. |
| Objetos y personajes | Se observan imágenes SVG embebidas y otras referenciadas bajo `/play/assets/`. Las mesas tienen identificadores de agrupación `data-table-group`, una señal de que el render agrupa casillas del mismo objeto. Los personajes colocados aparecen como retratos con identificadores visibles. |
| Panel derecho | Controles de marca X, borrado con indicación de mantener pulsado, deshacer y enviar. También aparecen cómo jugar, acerca de, compartir, imprimir, sonido y opciones. Los separadores de los paneles tienen cursor de redimensionamiento en esta vista. |
| Estado de cierre | Una capa sobre el tablero oscurece el plano y muestra el mensaje de resolución y la acción para volver a jugar. El HTML contiene reglas CSS para reducir algunas animaciones según la preferencia del sistema. |

La página monta la aplicación en `#root` y carga un módulo principal y una hoja de estilos bajo `/play/assets/`. Un comentario identifica Vite y el prefijo de despliegue `/play/`. Las precargas nombran módulos de React, Firebase y Firestore, datos de idioma, lógica de puzles, generador y pantalla de partida. Esas referencias indican cómo se distribuyen los recursos del cliente. La captura por sí sola no muestra qué se guarda en Firebase, qué papel desempeña el módulo generador en los casos publicados ni dónde y cómo se valida un envío. [HTML local](MordokuPage%20Html.txt)

El caso avanzado combina dos clases de restricciones. Las pistas individuales describen zonas, muebles, compañía, distancias y conteos relativos. Las reglas generales indican que hay cinco propietarios de despacho y que cada uno ocupa el suyo. Por ejemplo, una pista obliga a estar exactamente una fila al sur de alguien de ese grupo, mientras otra cuenta cuántos integrantes del grupo quedan al oeste. Un modelo de casos avanzados necesita expresar tanto la relación espacial como el grupo al que se refiere. [HTML local](MordokuPage%20Html.txt)

La revisión del HTML fue estática. Quedan por verificar los gestos de colocación, el comportamiento de la X y del borrado, el orden de las acciones de envío, la respuesta ante errores, la recuperación tras recargar y la experiencia móvil y con teclado.

## 4. Implicaciones para el proyecto

| Aspecto | Propuesta para una primera versión |
| --- | --- |
| Caso jugable | Un caso original 6×6 en español con una víctima, un reparto reducido, zonas claras y pistas directas. Un segundo caso puede introducir pistas de compañía o conteo para probar la extensión del formato. |
| Datos del caso | Describir dimensiones, zonas, paredes, qué casillas abarca cada objeto y cuáles se pueden ocupar. Registrar personajes, pistas individuales, reglas generales y una solución de referencia con las posiciones y el culpable. |
| Estado de partida | Registrar posiciones confirmadas, descartes del jugador e historial de cambios. Al deshacer o mover una persona debe poder recuperarse el estado de sus anotaciones sin confundirlas con las casillas bloqueadas por mobiliario. |
| Validación de contenido | Comprobar al crear cada caso que hay una sola distribución que satisface sus reglas y que conduce al culpable previsto. Una explicación por deducciones ayuda a detectar pistas ambiguas y a calibrar la dificultad. |
| Interfaz | Priorizar lectura conjunta de pistas y plano, distinción entre zonas y objetos, colocación y corrección de posiciones y un cierre claro. Usar nombres, símbolos y límites visibles junto al color para identificar elementos. |

### Casos límite para el diseño

- Dos personas en la misma fila, aunque estén separadas por una pared.
- Dos casillas contiguas en zonas diferentes, o dos casillas en diagonal, ante una pista de «junto a».
- Un objeto que abarca varias casillas y una silla que sí se puede ocupar.
- Una tercera persona en la zona de la víctima, que invalida la condición «a solas con».
- Una acusación correcta con posiciones incompatibles y una distribución alternativa que también satisface las pistas. La primera prueba obliga a definir qué exige la interfaz al enviar. La segunda detecta un caso ambiguo antes de publicarlo.

El cierre de la primera versión puede definirse como una partida completa en la que se leen las pistas, se colocan y corrigen personajes, se anotan descartes y se verifica la solución. Las reglas especiales, las investigaciones de varias cuadrículas y la publicación periódica son extensiones posibles del formato.
