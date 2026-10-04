# Mis finanzas — PWA privada

Aplicación web móvil para consultar un histórico financiero sin subir los movimientos a ningún servidor. El usuario importa el histórico completo desde un JSON y la aplicación lo guarda únicamente en IndexedDB, dentro del navegador del dispositivo.

## Privacidad

- El repositorio contiene solo código, estilos, iconos y pruebas con datos inventados en memoria.
- No hay APIs externas, cuentas, analítica, telemetría, publicidad ni trackers.
- Cada nueva importación reemplaza de forma atómica el histórico local anterior.
- `.gitignore` bloquea formatos habituales de extractos y exportaciones financieras.
- El botón **Eliminar datos locales** borra el histórico almacenado en este navegador.

## Formato de importación

El archivo debe ser JSON válido con una propiedad `movements` que contenga una lista. También se admite directamente una lista de movimientos. Campos admitidos, con alias en español e inglés:

| Dato | Campos admitidos |
|---|---|
| Fecha | `date`, `fecha`, `operation_date`, `fecha_operacion` |
| Importe | `amount`, `importe`, `monto`, `value` |
| Tipo | `type`, `tipo`, `movement_type`, `tipo_movimiento` |
| Comercio | `merchant`, `comercio`, `counterparty`, `beneficiario` |
| Concepto | `concept`, `concepto`, `description`, `descripcion` |
| Categoría | `category`, `categoria` |
| Medio de pago | `payment`, `medio_pago`, `payment_method`, `metodo_pago` |
| Cuenta/tarjeta | `account`, `cuenta`, `card`, `tarjeta`, `account_card` |
| Estado | `status`, `estado` |
| Gasto neto opcional | `net_spend`, `gasto_neto` |

Las fechas pueden usar `AAAA-MM-DD` o `DD/MM/AAAA`. Los movimientos excluidos y las transferencias internas se conservan para consulta, pero tienen gasto e ingreso cero. Ingresos reales se identifican con tipo `Ingreso`; devoluciones, reembolsos y abonos reducen el gasto y no se suman también como ingreso.

## Uso y actualización

1. Abre la aplicación publicada bajo HTTPS.
2. Pulsa **Elegir archivo JSON** o, si ya hay datos, **Datos → Actualizar histórico**.
3. Selecciona el histórico completo. La aplicación valida y reemplaza la copia local anterior.
4. Para actualizar el código, publica una nueva versión. El Service Worker busca archivos nuevos en red y conserva una copia para uso sin conexión. IndexedDB no forma parte de la caché y no se borra al actualizar el código.

## Desarrollo y pruebas

La aplicación no necesita compilación ni dependencias en producción. Sirve esta carpeta mediante cualquier servidor HTTP local; los Service Workers solo se activan en `localhost` o HTTPS.

Las pruebas unitarias se ejecutan con:

```text
node tests/logic.test.js
```

GitHub Pages se despliega con el workflow incluido en `.github/workflows/pages.yml`.
