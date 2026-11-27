# Assoku 1.3.0 · soluciones de los cinco casos

Esta hoja revela las posiciones y los culpables. El botón **Ver solución paso a paso** de cada caso muestra las deducciones sobre el tablero.

## El último lote · fácil

- **Primera apertura.** Amalia ocupa la única silla del Obrador, en B2. Su fila fija a Baltasar en F1 y reduce las opciones de Constanza. Su columna recorta las de Darío y Eliana.
- **Segunda apertura.** Gisela ocupa el único puf de Descanso, en A8. Su columna descarta A2 para Darío y A5 para Eliana. Su fila excluye las casillas del extremo sur de Patio para Favio.
- Baltasar en F1 deja a Constanza en la fila 3. Como ella está al noreste de Darío, él se ubica en D4 y deja a Eliana en C6. Favio debe quedar al suroeste de Baltasar, y las filas y columnas disponibles solo le permiten E5 o E7. Al aplicar la cuota de cuatro personas sentadas, Constanza ocupa el banco de H3 y Favio el de E7. Los ejes libres sitúan a León en G5, en Patio con Favio.
- **Posiciones.** Amalia B2, Baltasar F1, Constanza H3, Darío D4, Eliana C6, Favio E7, Gisela A8 y León G5.

## El último ciclo · fácil

- **Primera apertura.** Amaro ocupa el único puf de Descanso, en B7. Su fila fija a Lidia en H5 y a Teo en E3. Su columna elimina opciones de Uriel junto a la tabla de planchar.
- **Segunda apertura.** Nerea ocupa el único sillón del Vestíbulo, en C1. Su fila elimina H1 para Sara y su columna recorta las opciones de Uriel. La pista del puf fija a Amaro por separado.
- H5 de Lidia elimina H3 para Sara, que queda en G2. Al descartar las columnas B y C, Uriel queda en A4. Su fila deja a Raúl en D6, junto al mostrador. Vera queda en F8 en Entrega con Lidia.
- **Posiciones.** Amaro B7, Lidia H5, Nerea C1, Raúl D6, Sara G2, Teo E3, Uriel A4 y Vera F8.

## El molde extraviado · medio

- **Primera apertura.** La única casilla de alfombra de la columna A es A9. Abril elimina las opciones de la fila 9 para Celso y las de la columna A para Micaela.
- **Segunda apertura.** Leire ocupa el único puf de Galería, en D1. Su fila descarta los vecinos del banco de trabajo superior para Breno que están en esa fila. Su columna recorta las opciones de Micaela.
- Jimena y Tomás tienen inicialmente las mismas sillas posibles, J2 y B6, en talleres distintos. La regla de acceso al Taller de esmalte fija J2 para Jimena. La fila 2 y la columna J dejan B6 para Tomás. Micaela e Ingrid se reparten las filas 4 y 5. La pista de que Micaela está al norte fija C4 e I5. Nilo reserva la columna H y su posición al sur de Saúl resuelve las filas 7 y 8. Leire es la única persona con Saúl en Galería.
- **Posiciones.** Abril A9, Breno G3, Celso F10, Ingrid I5, Jimena J2, Leire D1, Micaela C4, Nilo H8, Saúl E7 y Tomás B6.

## El cierre del balneario · medio

- **Primera apertura.** Alicia ocupa el único puf de Entrada, en B2. Su fila descarta varias alternativas de Héctor junto a las jardineras. Su columna recorta las opciones de César y Omar en Vestuario.
- **Segunda apertura.** En Masajes, Dafne ocupa C8, la única casilla de cama de la fila 8. La columna C elimina C5 para César y Omar. La fila 8 elimina G8 para Ernesto.
- La columna E queda reservada para Maite. Ella y Héctor se reparten las filas 1 y 3 y la pista del norte los ordena. Tras situar a Omar en A4 y a César en D6, a Rocío y Ulises les quedan las filas 5 y 7. Rocío debe ir al noroeste de Ulises, así que quedan en G5 y J7. Ernesto es la única persona con Irene en Reposo.
- **Posiciones.** Alicia B2, César D6, Dafne C8, Ernesto F9, Héctor H1, Irene I10, Maite E3, Omar A4, Rocío G5 y Ulises J7.

## El relevo del refugio · difícil

- Julia reserva la fila 10 y Lorenzo ocupa L8. Esas filas dejan a Silvia en C9. Nico reserva la fila 3. Los dormitorios ofrecen las columnas H y K para Inés y Cristóbal. La pista del noreste fija a Inés en H4 y deja a Cristóbal entre K1 y K2.
- Galo reserva la columna G, lo que deja a Fiona en F7. Su distancia de cinco columnas restringe a Ágata a la columna A. La fila 4 de Inés deja a Elías en E5 y la pista del sur fija a Ágata en A6.
- Solo Silvia y Nico pueden sumar las dos personas sentadas. Nico ocupa el banco de D3. Solo Rebeca puede ocupar Guardia sur, que exige una persona. Al descartar K por la reserva de Cristóbal, Rebeca queda en J12 y la columna J deja a Julia en I10. Por las filas y columnas disponibles, Valerio queda en B2, en Radio con Nico.
- **Posiciones.** Ágata A6, Cristóbal K1, Elías E5, Fiona F7, Galo G11, Inés H4, Julia I10, Lorenzo L8, Nico D3, Rebeca J12, Silvia C9 y Valerio B2.

## Validación

- Una búsqueda exhaustiva desde los datos públicos devolvió una sola distribución por caso y un único acompañante para cada víctima. Los cuatro tableros fáciles y medios se resolvieron por deducción desde cada una de sus dos aperturas.
- Quitar la cuota de asientos de El último lote, la regla de acceso de El molde extraviado, la cuota de asientos de El relevo del refugio o la cuota de Guardia sur, por separado, admite al menos dos soluciones en el caso correspondiente. La pista del noroeste del balneario y las del noreste y del sur del refugio también son decisivas.
- `python -m app.levels.walkthrough` validó el catálogo. En la API se comprobaron la versión, las fichas públicas, los recorridos y la corrección de posiciones.
- En Chromium se comprobó que los cinco casos se abren desde el catálogo y muestran su reparto y reglas. Los rótulos se revisaron a 320, 390 y 1200 píxeles para comprobar que el texto queda visible, dentro del plano y sin superposiciones.
