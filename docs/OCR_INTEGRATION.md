# Integración OCR con Azure Computer Vision para Asignación de Carros

## 📋 Resumen Ejecutivo

Esta implementación extiende el sistema de dismissal para permitir que los allocators agreguen carros a la cola mediante la captura fotográfica de placas vehiculares, utilizando Azure Computer Vision OCR para automatizar el proceso.

## 🎯 Objetivo

Permitir que el allocator:
1. Capture una foto de la placa del vehículo
2. El sistema extraiga automáticamente el número de placa mediante OCR
3. Busque el estudiante asociado a esa placa
4. Obtenga el color del carro y el número de carro
5. Posicione el carro en el carril correspondiente con su color correcto

## 🏗️ Arquitectura de la Solución

### 1. Modelo de Datos

#### Schema Extensions (`convex/schema.ts`)

```typescript
students: {
  // Campos existentes...
  carNumber: v.number(),
  
  // NUEVOS CAMPOS:
  licensePlate: v.optional(v.string()),  // e.g., "CFO-682"
  carColor: v.optional(v.string()),      // e.g., "red", "blue", "white"
}

// Nuevo índice para búsqueda eficiente
.index("by_license_plate", ["licensePlate", "campusLocation"])
```

**Decisiones de diseño:**
- `licensePlate` es opcional para mantener compatibilidad con estudiantes existentes
- Se normaliza a MAYÚSCULAS para búsqueda consistente
- `carColor` almacena nombres de color en texto plano (fácil de editar manualmente)
- El índice compuesto permite búsquedas rápidas por placa dentro de un campus

### 2. API Endpoints

#### A. `/api/ocr-plate` - Extracción de Placa

**Responsabilidad:** Recibir imagen y extraer texto de la placa mediante Azure OCR.

**Flujo:**
```
1. Recibe imagen (POST multipart/form-data)
2. Valida credenciales de Azure
3. Convierte imagen a buffer
4. Llama a Azure Computer Vision API
5. Extrae texto completo (ej: "CFO-682 CALI")
6. Aplica regex para extraer solo la placa ("CFO-682")
7. Retorna placa normalizada
```

**Patrones de Placa Soportados:**
- `AAA-999` (Colombia): CFO-682
- `AAA999` (sin guión): CFO682
- Formato general: 2-4 letras + 2-4 números

**Manejo de Errores:**
- `AZURE_NOT_CONFIGURED`: Credenciales faltantes
- `NO_IMAGE`: No se envió imagen
- `NO_TEXT_DETECTED`: OCR no detectó texto
- `INVALID_PLATE_FORMAT`: Texto detectado pero no coincide con patrón de placa
- `AZURE_API_ERROR`: Error de Azure
- `INTERNAL_ERROR`: Errores inesperados

**Código clave:**
```typescript
function extractLicensePlate(text: string): string | null {
  const pattern = /([A-Z]{3}-\d{3})/; // AAA-999
  const match = text.match(pattern);
  return match ? match[1] : null;
}
```

#### B. `/api/students/by-plate` - Búsqueda por Placa

**Responsabilidad:** Consultar estudiantes por placa en un campus específico.

**Parámetros Query:**
- `plate`: Placa a buscar (string)
- `campus`: Campus del estudiante (string)

**Flujo:**
```
1. Valida parámetros requeridos
2. Normaliza placa (UPPERCASE, trim)
3. Consulta Convex usando índice by_license_plate
4. Retorna array de estudiantes (usualmente 1)
```

**Casos especiales:**
- Array vacío: Placa no encontrada
- Múltiples resultados: Hermanos con mismo carro/placa
- Error de autenticación: Retorna error 401

### 3. Convex Queries & Mutations

#### Query: `students.getByLicensePlate`

```typescript
export const getByLicensePlate = query({
    args: {
        licensePlate: v.string(),
        campus: v.string()
    },
    handler: async (ctx, args) => {
        // Busca usando índice optimizado
        // Normaliza a UPPERCASE para consistencia
    }
});
```

**Performance:** O(log n) gracias al índice compuesto.

#### Mutations Extendidas: `students.create` y `students.update`

Ahora aceptan campos adicionales:
- `licensePlate` (opcional)
- `carColor` (opcional)

Se normalizan automáticamente al guardar.

### 4. Integración de Color en Queue

#### Función: `mapStudentColorToHex`

Convierte nombres de color en texto a códigos hexadecimales.

**Paleta de Colores:**
```typescript
{
  'red' / 'rojo': '#ef4444',
  'blue' / 'azul': '#3b82f6',
  'white' / 'blanco': '#f3f4f6',
  'black' / 'negro': '#1f2937',
  // + 20 colores más (inglés/español)
}
```

**Fallback:** Si el color no existe en la paleta, usa gris (`#6b7280`).

**Decisiones de diseño:**
- Soporte bilingüe (inglés/español)
- Variantes (dark blue, light green, etc.)
- Colores restringidos para consistencia visual
- Mapeo determinístico (mismo input = mismo output)

#### Lógica en `queue.addCar`

```typescript
// Prioridad 1: Usar color del estudiante si existe
const studentWithColor = students.find(s => s.carColor);
const carColor = studentWithColor?.carColor 
    ? mapStudentColorToHex(studentWithColor.carColor)
    : generateCarColor(args.carNumber); // Prioridad 2: Color por número

// Resultado: queue entry con color apropiado
```

### 5. Frontend - Interfaz de Usuario

#### Componente: `DismissalView.tsx`

**Nuevo estado:**
```typescript
const [isProcessingOCR, setIsProcessingOCR] = useState(false);
```

**Handler: `handlePlateCapture`**

Flujo completo del usuario:
```
1. Usuario hace clic en botón de cámara 📷
2. Selecciona/captura foto de placa
3. handlePlateCapture se ejecuta:
   a. Valida que campus esté seleccionado
   b. Envía imagen a /api/ocr-plate
   c. Recibe placa extraída (ej: "CFO-682")
   d. Consulta /api/students/by-plate
   e. Obtiene carNumber del primer estudiante
   f. Auto-completa el input con el número
   g. Muestra alerta de éxito
4. Usuario presiona ← o → para asignar carril
```

**UI Components:**
- Botón de cámara (verde/turquesa) al lado del micrófono
- Loading state con animación pulse cuando procesa
- Tooltip informativo
- Input deshabilitado durante OCR
- `capture="environment"` usa cámara trasera en móviles

**Integración con Speech-to-Text:**
- Ambos botones coexisten
- Se deshabilitan mutuamente para evitar conflictos
- Input ampliado para acomodar 2 botones

### 6. Manejo de Errores

#### Por Capa:

**Azure OCR:**
- Timeout de red → Reintentar
- Imagen borrosa → "No text detected"
- Formato no reconocido → "Invalid plate format"

**Base de Datos:**
- Placa no encontrada → Alert: "Plate Not Found"
- Sin car number → "No Car Assigned"
- Multiple students → Usa el primero (hermanos)

**UI:**
- Alertas visuales con iconos
- Mensajes en contexto del usuario
- Auto-dismiss después de 5 segundos
- Click para cerrar manualmente

## 📊 Flujo de Datos Completo

```
┌─────────────┐
│   Usuario   │
│ (Allocator) │
└──────┬──────┘
       │ 1. Captura foto
       ▼
┌─────────────────┐
│  dismissal-view │
│   (Frontend)    │
└──────┬──────────┘
       │ 2. POST /api/ocr-plate
       ▼
┌──────────────────────┐
│   Azure Computer     │
│      Vision API      │
│    (OCR Service)     │
└──────┬───────────────┘
       │ 3. Retorna: "CFO-682 CALI"
       ▼
┌─────────────────┐
│  extractPlate() │ → "CFO-682"
└──────┬──────────┘
       │ 4. GET /api/students/by-plate?plate=CFO-682&campus=X
       ▼
┌──────────────────────┐
│  Convex Query        │
│  getByLicensePlate   │
└──────┬───────────────┘
       │ 5. Retorna: [{ carNumber: 123, carColor: "blue" }]
       ▼
┌─────────────────┐
│   Frontend      │
│ Auto-fill: 123  │
└──────┬──────────┘
       │ 6. Usuario elige carril ← o →
       ▼
┌──────────────────────┐
│  queue.addCar        │
│  + mapColorToHex     │
└──────┬───────────────┘
       │ 7. Inserta en dismissalQueue con color #3b82f6
       ▼
┌─────────────────┐
│   Road View     │
│ Muestra carro   │
│ azul en carril  │
└─────────────────┘
```

## 🔒 Seguridad y Validación

### Validaciones por Capa:

**API Layer:**
- Validación de tipo de archivo (image/*)
- Límite de tamaño implícito de Azure
- Sanitización de query parameters

**Database Layer:**
- Autenticación requerida (Clerk)
- Normalización de placas (UPPERCASE, trim)
- Índices previenen duplicados por accidente

**Frontend:**
- Deshabilita botones durante procesamiento
- Validación de campus seleccionado
- Manejo de errores user-friendly

## 🚀 Casos de Uso

### Caso 1: Flujo Exitoso
```
Usuario: Toma foto de placa "CFO-682"
Sistema: ✓ OCR detecta "CFO-682 CALI"
Sistema: ✓ Encuentra estudiante Juan Pérez, carro #123, color rojo
Sistema: ✓ Auto-completa input con "123"
Usuario: ← (Carril izquierdo)
Sistema: ✓ Carro rojo #123 aparece en carril izquierdo
```

### Caso 2: Placa No Encontrada
```
Usuario: Toma foto de placa "XYZ-999"
Sistema: ✓ OCR detecta "XYZ-999"
Sistema: ✗ No encuentra estudiante
Sistema: Muestra "No students found with plate XYZ-999"
Usuario: Puede intentar de nuevo o ingresar manualmente
```

### Caso 3: OCR Falla
```
Usuario: Toma foto borrosa
Sistema: ✗ OCR no detecta texto legible
Sistema: Muestra "Could not extract a valid plate"
Usuario: Puede tomar otra foto o usar entrada manual
```

### Caso 4: Color No en Paleta
```
Estudiante: Color registrado "dorado"
Sistema: ✓ mapColorToHex('dorado') → null
Sistema: ✓ Usa color por defecto gris (#6b7280)
Carro: Aparece en color gris (fallback seguro)
```

## 📈 Optimizaciones y Performance

### Índices de Base de Datos:
- `by_license_plate`: Búsqueda O(log n)
- `by_car_campus`: Búsqueda por número O(log n)

### Caching:
- Azure SDK maneja caching de credenciales
- Convex usa reactive queries (actualizaciones automáticas)

### Network:
- Compresión de imagen en cliente (browser nativo)
- Single round-trip para OCR
- Consultas paralelas posibles (OCR + pre-fetch students)

## 🔄 Compatibilidad hacia Atrás

- Estudiantes sin `licensePlate` funcionan normalmente
- Estudiantes sin `carColor` usan color generado
- Flujo manual (input directo) sigue funcionando
- Speech-to-text no afectado

## 🎨 UX Considerations

### Estados Visuales:
- **Idle:** Botón verde con icono cámara
- **Processing:** Botón naranja pulsante
- **Success:** Alert verde con checkmark
- **Error:** Alert rojo con X

### Accesibilidad:
- Tooltips informativos
- Mensajes de error descriptivos
- Estados disabled claros
- Compatible con lectores de pantalla

### Mobile-First:
- `capture="environment"` usa cámara trasera
- Botones optimizados para touch (44x44px)
- Responsive layout

## 🧪 Testing Recommendations

### Unit Tests:
- `extractLicensePlate()` con diversos formatos
- `mapStudentColorToHex()` con colores válidos/inválidos
- Normalización de placas

### Integration Tests:
- Flujo completo OCR → Query → Queue
- Manejo de errores en cada paso
- Timeout scenarios

### E2E Tests:
- Usuario captura placa → carro aparece
- Placa no encontrada → error apropiado
- Cambio de campus → reset state

## 📝 Mantenimiento Futuro

### Extensiones Posibles:
1. **OCR Mejorado:** Pre-procesamiento de imagen (crop, rotate, enhance)
2. **Caché de Placas:** Redis para placas frecuentes
3. **Múltiples Placas:** Hermanos con carros diferentes
4. **Validación de Placa:** Formato por región/país
5. **Historial de OCR:** Auditoría de lecturas
6. **Corrección Manual:** UI para editar placa detectada antes de buscar

### Monitoreo:
- Logs de OCR success/failure rate
- Tiempo promedio de procesamiento
- Placas más buscadas
- Errores de Azure (rate limits, quotas)

## 📚 Referencias

- [Azure Computer Vision OCR](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-ocr)
- [Convex Schema Design](https://docs.convex.dev/database/schemas)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

---

**Implementado por:** GitHub Copilot  
**Fecha:** Noviembre 2025  
**Versión:** 1.0
