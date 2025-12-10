# Sistema de Avatares - Estructura de Archivos

## Estructura de Carpetas

```
avatars/
├── base/
│   ├── male.png          # Personaje base masculino
│   └── female.png        # Personaje base femenino
├── male/                  # Atuendos para personaje masculino
│   ├── Cabeza/           # Sombreros, gorros, cascos (HEAD)
│   ├── Pelo/             # Peinados, pelucas (HAIR)
│   ├── Ojos/             # Lentes, máscaras, accesorios faciales (EYES)
│   ├── Superior/         # Camisas, chaquetas, armaduras superiores (TOP)
│   ├── Inferior/         # Pantalones, faldas, armaduras inferiores (BOTTOM)
│   ├── Mano izquierda/   # Escudos, objetos mano izquierda (LEFT_HAND)
│   ├── Mano derecha/     # Armas, varitas, objetos mano derecha (RIGHT_HAND)
│   ├── Zapatos/          # Zapatos, botas, sandalias (SHOES)
│   ├── Espalda/          # Capas, alas, mochilas (BACK)
│   └── Bandera/          # Banderas, estandartes (FLAG)
└── female/               # Atuendos para personaje femenino
    ├── Cabeza/
    ├── Pelo/
    ├── Ojos/
    ├── Superior/
    ├── Inferior/
    ├── Mano izquierda/
    ├── Mano derecha/
    ├── Zapatos/
    ├── Espalda/
    └── Bandera/
```

## Especificaciones de Imágenes

- **Formato**: PNG con transparencia
- **Tamaño**: Mismo tamaño que el personaje base (255x444px)
- **Posición**: Las imágenes deben estar posicionadas para superponerse correctamente sobre el personaje base

## Orden de Capas (de abajo hacia arriba)

1. **FLAG** (z-index: 0) - Banderas, detrás del personaje
2. **BACK** (z-index: 1) - Capas, alas, mochilas
3. **SHOES** (z-index: 2) - Zapatos
4. **BOTTOM** (z-index: 3) - Pantalones, faldas
5. **TOP** (z-index: 4) - Camisas, chaquetas
6. **LEFT_HAND** (z-index: 5) - Escudos, objetos
7. **RIGHT_HAND** (z-index: 6) - Armas, varitas
8. **EYES** (z-index: 7) - Lentes, máscaras
9. **HEAD** (z-index: 8) - Sombreros, gorros
10. **HAIR** (z-index: 9) - Peinados (encima de todo)

## Nomenclatura Sugerida

```
[nombre].png

Ejemplos:
- gorro_santa.png
- chaqueta_navidad.png
- pantalon_formal.png
- varita_magica.png
```

## Mapeo de Slots a Carpetas

| Slot | Carpeta |
|------|---------|
| HEAD | Cabeza |
| HAIR | Pelo |
| EYES | Ojos |
| TOP | Superior |
| BOTTOM | Inferior |
| LEFT_HAND | Mano izquierda |
| RIGHT_HAND | Mano derecha |
| SHOES | Zapatos |
| BACK | Espalda |
| FLAG | Bandera |

## Cómo Agregar Nuevos Items

1. Coloca la imagen PNG en la carpeta correspondiente (male/[Carpeta]/ o female/[Carpeta]/)
2. **IMPORTANTE**: La imagen debe tener el mismo tamaño que el avatar base (255x444px) y estar posicionada correctamente para superponerse
3. Usa la API para crear el item en la base de datos:

```javascript
await avatarApi.createItem({
  name: 'Gorro de Santa',
  description: 'Un festivo gorro navideño',
  gender: 'MALE', // o 'FEMALE'
  slot: 'HEAD',
  imagePath: '/avatars/male/Cabeza/gorro_santa.png',
  layerOrder: 8, // según el slot
  basePrice: 150,
  rarity: 'RARE'
});
```

4. El docente puede añadir el item a la tienda de su clase con el precio que desee.
