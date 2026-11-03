# Nobleza y valor

App personal (no oficial) de seguimiento estadístico del Real Zaragoza en Primera Federación (Grupo 2), temporada 2026/27.

## Secciones
- **Inicio**: posición, puntos, proyección, próximo partido, microobjetivo en curso y ritmo de puntos.
- **Temporada**: clasificación completa, evolución en la tabla, carrera por el ascenso, goles por jornada y casa/fuera.
- **Campeones**: Zaragoza frente a los últimos campeones de 1ª RFEF (22/23 a 25/26), con las fichas tipo infografía, las curvas de puntos y las referencias de 1º, 2º, play-off y salvación.
- **Micro**: los microobjetivos de Ibai Gómez (bloques de 4 partidos, mínimo 7 puntos).
- **Plantilla**: minutos, partidos, titularidades, goles y asistencias de cada jugador, gráficas y comparador.
- **Acta**: registro rápido de cada partido (once, cambios, goles, tarjetas y estadísticas) más los ajustes de sincronización.

## De dónde salen los datos
| Dato | Fuente | Cómo se actualiza |
|---|---|---|
| Calendario 26/27 | RFEF (marcadores.rfef.es) | Fijo (`data/season.json`) |
| Resultados y clasificación | Wikipedia (en y es) | Botón **Actualizar** (y automáticamente al abrir si han pasado más de 6 h) |
| Plantilla hasta la J10 | AupaZaragoza.com | Fijo; desde la J11 se suma lo que registras en el Acta |
| Histórico 22/23-24/25 | API-Football (plan gratuito) | Fijo (`data/history.json`) |
| Campeones 25/26 | Wikipedia + calendario RFEF | Fijo |

Tus actas y fotos se guardan en el navegador y, si configuras GitHub en la pestaña Acta, en `data/user.json` de este repositorio.

## Publicar en GitHub Pages
1. Sube todo el contenido de esta carpeta a la raíz del repositorio.
2. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
3. La app quedará en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`. En el móvil, "Añadir a pantalla de inicio".

## Guardar las actas en GitHub (opcional)
GitHub → Settings → Developer settings → Fine-grained tokens → nuevo token con acceso **solo a este repositorio** y permiso **Contents: Read and write**. Pégalo en la pestaña Acta → Datos y sincronización. El token solo se guarda en tu dispositivo.

## Al cambiar archivos de la app
Sube el número de `CACHE_VERSION` en `sw.js` para que el móvil descargue la versión nueva.
