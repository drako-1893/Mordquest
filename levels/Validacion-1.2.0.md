# Assoku 1.2.0 · soluciones de los cinco casos

Esta hoja contiene las posiciones y los culpables. El botón de solución de cada caso muestra el recorrido completo, con las posiciones confirmadas en cada paso.

## El sello del atlas · fácil

- **Apertura 1.** Adela debe estar junto a un puf y a un sillón en la misma zona. El único cruce es H7. La fila 7 y la columna H recortan las opciones de Beltrán y Cipriana.
- **Apertura 2.** En la columna D, la única casilla junto a un atril es D5. Al colocar allí a Fermín, la fila 5 y la columna D recortan las opciones de Beltrán y Damián.
- Descartar la fila 5 deja a Beltrán en G2 y a Damián en E6. La columna E de Damián termina de fijar a Cipriana en F4, en una de las dos salas de lectura. Gema es la única persona en la sala de mapas con Ivo.
- **Posiciones.** Adela H7, Beltrán G2, Cipriana F4, Damián E6, Eugenia A8, Fermín D5, Gema C3 e Ivo B1.

## La llamada del estanque · fácil

- **Apertura 1.** D6 es la única casilla junto al agua y a la fuente. Colocar a Bosco allí recorta, por fila o columna, las opciones de Ciro, Delia e Hilda.
- **Apertura 2.** Eva ocupa el único puf del vivero, en A8. Su fila y su columna recortan las opciones de Alma y Delia.
- La fila 6 de Bosco reduce las opciones de Delia en el vivero a B7 y A8. La fila 8 de Eva fija B7. Los ejes ocupados dejan a Joel en G3. Gaspar es la única persona con Joel en el umbráculo.
- **Posiciones.** Alma F4, Bosco D6, Ciro C1, Delia B7, Eva A8, Gaspar E2, Hilda H5 y Joel G3.

## La ficha del campeonato · fácil

- **Apertura 1.** Aitana ocupa el único puf de Arcades, en G2. Su fila y su columna recortan las opciones de Brais, Coral y Darío.
- **Apertura 2.** Greta ocupa la única casilla de alfombra en la columna A, en A8. Su fila y su columna recortan las opciones de Brais y Coral.
- La columna G de Aitana fija a Brais en H3 y deja a Coral entre F7 y H7. La columna H de Brais fija F7. Greta es la única persona con Hugo en Descanso.
- **Posiciones.** Aitana G2, Brais H3, Coral F7, Darío E1, Elba C5, Félix D4, Greta A8 y Hugo B6.

## El cambio de andén · medio

- **Apertura 1.** En la fila 3, F3 es la única casilla junto a un banco. Colocar a Biel allí recorta las opciones de Aurora, Elisa, Flor e Ismael.
- **Apertura 2.** En la columna G, G6 es la única casilla junto a un sillón. Colocar a Helena allí recorta las opciones de Aurora, Elisa e Ismael.
- Flor queda junto a la mesa de Taquilla en C4. Ismael está al sur de Flor, por lo que sus opciones de la columna H se reducen a H5, H7 y H8 en ese paso. La fila 5 de Elisa y la fila 8 de Aurora fijan H7. Biel es la única persona con Jacinta en el andén.
- **Posiciones.** Aurora B8, Biel F3, Catalina D2, Dimas A9, Elisa E5, Flor C4, Gonzalo I10, Helena G6, Ismael H7 y Jacinta J1.

## El informe de mareas · difícil

- Diana reserva la fila 9. La columna A de Iván la deja en C9. Gabriel reserva la fila 8 y debe estar a cuatro columnas de ella. Eso fija G8.
- La pista de Lisandro exige seis columnas de distancia respecto de Cástor. Al cruzar los bancos con las opciones que quedan en el muelle, se fijan H6 para Lisandro y B4 para Cástor.
- Tras las reservas, solo Abel, Hebe e Iván pueden completar el recuento de tres personas sentadas. Abel queda en J7, Hebe en D3 e Iván en A2. Lisandro es la única persona con Mara en la pasarela.
- **Posiciones.** Abel J7, Bruna K12, Cástor B4, Diana C9, Eloy L10, Fabiola I1, Gabriel G8, Hebe D3, Iván A2, Jimena E11, Lisandro H6 y Mara F5.

## Validación

- La búsqueda exhaustiva desde las pistas públicas encontró una sola solución por caso y confirmó que cada víctima comparte zona con una sola persona.
- Cada apertura documentada llega por deducción directa a la misma distribución. La pista direccional del caso medio es decisiva. En el difícil, quitar por separado cualquiera de las dos distancias o el recuento de asientos admite al menos dos soluciones.
- El comando `python -m app.levels.walkthrough` validó el catálogo. Se comprobó por API la presencia de los cinco casos en la versión 1.2.0 y se verificaron sus rutas, recorridos y resultados.
- En Chromium se comprobó que los cinco tableros cargan con su reparto completo y que sus rótulos no se superponen ni salen del tablero a 320, 390 y 1200 píxeles de ancho.
