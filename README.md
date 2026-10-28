# Sudoku Simple

App Android sencilla, en español, inspirada en la referencia visual: fondo claro, números azules, tablero grande y teclado del 1 al 9. Funciona completamente sin conexión, sin anuncios, cuentas, compras ni recompensas.

## Jugar

- Elegí **Fácil**, **Intermedio** o **Difícil** y tocá **Empezar a jugar**.
- Tocá una casilla: se sombrean su fila, columna y bloque de 3×3. Las coincidencias del número seleccionado se pintan de azul, con un tono más intenso en la selección.
- Tocá un número del teclado para colocarlo. Los números originales son fijos.
- **Deshacer**, **Borrar**, **Notas** y **Pista** son las únicas herramientas. Las pistas son ilimitadas.
- Cuando quedan **10 casillas vacías o menos** y todos los números colocados son correctos, aparece **Autocompletar** debajo del tablero. Al tocarlo se rellenan las casillas una por una, cada 220 ms, resaltando la casilla que se completa. El mensaje final aparece 250 ms después del último número. Durante la animación se bloquean los controles; si salís de la app, se detiene y se conservan los números que ya se mostraron. Se oculta durante la pausa y si hay algún número incorrecto.
- Las repeticiones se marcan en rojo; no hay vidas ni penalizaciones.
- El popup de finalización y su fondo aparecen con una transición suave de 240 ms. Se respeta la preferencia del dispositivo de reducir movimiento.
- La partida y el tiempo se guardan automáticamente en el dispositivo. Al salir, la partida se pausa; tocá **Continuar** al volver. Deshacer conserva el historial de la sesión actual.
- **Nueva partida** permite cambiar de nivel; el selector avisa que reemplaza la partida actual.

Los tableros se generan localmente y se comprueba que tengan una única solución. Los niveles usan aproximadamente 42, 33 y 27 pistas iniciales; la dificultad se basa en la cantidad de pistas, sin clasificación avanzada por técnicas de resolución. Si quitar otra pista crea ambigüedad, se conserva.

## Ejecutar en Android

Abrí esta carpeta en **Android Studio**, dejá que sincronice Gradle, conectá un teléfono con depuración USB o iniciá un emulador y presioná **Run**.

Requisitos de compilación: JDK 17, Android SDK 35, Build Tools 35.0.0. El wrapper descarga Gradle 8.11.1; el proyecto usa Android Gradle Plugin 8.9.2. [Compatibilidad oficial](https://developer.android.com/build/releases/agp-8-9-0-release-notes).

También se puede generar un APK desde una terminal con Java y el SDK configurados:

```sh
./gradlew assembleDebug
```

En Windows:

```bat
gradlew.bat assembleDebug
```

El instalador queda en `app/build/outputs/apk/debug/app-debug.apk`. Es un APK de desarrollo firmado con la clave de depuración local, listo para instalar y probar, no una versión firmada para publicar en Play Store.

Si usás terminal, configurá `ANDROID_HOME` o creá `local.properties` con `sdk.dir=/ruta/a/tu/Android/sdk`. Android Studio puede generar ese archivo.

## Código

- `app/src/main/assets/engine.js`: generación, solución única, coincidencias, notas, pistas y deshacer.
- `app/src/main/assets/app.js`: interfaz, pausa y guardado local.
- `app/src/main/assets/index.html` y `style.css`: diseño adaptable.
- `app/src/main/java/ar/com/sudokusimple/MainActivity.java`: contenedor Android con WebView que sirve exclusivamente los recursos incluidos en el APK. No solicita permiso de Internet y bloquea navegación externa.

Se eligió Java + WebView local para mantener el proyecto pequeño y sin dependencias de ejecución adicionales. El SDK mínimo configurado es Android 6.0 (API 23); se recomienda tener Android System WebView actualizado.

## Pruebas y vista previa

Con Node.js instalado:

```sh
node --test tests/engine.test.cjs
```

Las pruebas verifican 75 tableros con solución única, sombreado de las 21 casillas relacionadas, coincidencias, protección de pistas originales, notas, deshacer, borrado, pistas, finalización, guardados inválidos y las condiciones de autocompletar.

En Android, los márgenes de la barra de estado, la barra de navegación y el recorte de cámara se aplican al contenedor nativo del WebView para que la cabecera quede dentro del área visible.

Para probar la misma interfaz en un navegador, sin Android:

```sh
python3 -m http.server 8765 --directory app/src/main/assets
```

Abrí `http://localhost:8765`. La vista previa sirve para probar el juego; la app Android incluye esos mismos archivos y no necesita este servidor.

Validación realizada: compilación del APK y pruebas del motor; revisión de interacción en navegador móvil. No se ejecutó en un teléfono Android ni en un emulador en este entorno.
