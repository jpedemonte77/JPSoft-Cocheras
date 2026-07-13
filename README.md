# JPSoft Cocheras

**Sistema de gestión para cocheras y estacionamientos privados**

Aplicación web moderna para administrar cocheras residenciales de forma simple, rápida y profesional. Accesible desde cualquier dispositivo — celular, tablet o computadora — sin instalaciones ni conocimientos técnicos.

---

## ¿Qué hace?

Centraliza en un solo lugar todo lo que necesitás para gestionar un estacionamiento: pagos, inquilinos, facturación, mensajes, gastos y mucho más. Los datos se sincronizan en tiempo real entre dispositivos — lo que cargás en el celular se ve al instante en la computadora.

---

## Secciones

### 🔲 Cocheras
Mapa visual con el estado de cada espacio en tiempo real. Libre, ocupado, tipo de vehículo. Acceso directo a la ficha completa del inquilino con un click. Configuración flexible del número total de espacios. Descarga del estado actual como imagen PNG para compartir o imprimir.

### 💳 Pagos
Registro mensual por inquilino con toggle visual pagado / pendiente. Selección de método de cobro (efectivo o transferencia) y administrador. Resumen mensual por administrador. Historial completo de pagos. Generación de recibos en PNG listos para enviar por WhatsApp. Confirmación al revertir un pago ya registrado.

### 🚙 Vehículos
Ficha completa por inquilino: nombre, DNI, domicilio, patente, tipo, marca y modelo, seguro, WhatsApp y monto de alquiler. Foto de cédula del vehículo (frente y dorso). Búsqueda y filtros por tipo de vehículo.

### 💲 Precios
Recaudación mensual total. Ajuste global por porcentaje o monto fijo. Historial de cambios con fecha y administrador responsable.

### 📈 Aumentos
Registro mensual de aumentos. Precios diferenciados para autos/pickups y motos. Indicador visual de cambios sin guardar. Historial completo con toggle por mes.

### 💬 Mensajes
Envío masivo a todos los inquilinos con un click. Mensajes individuales con texto pre-cargado. Todos los links de WhatsApp reutilizan la misma pestaña del navegador.

### 🧾 Facturación
Registro de datos fiscales completos: condición frente al IVA (11 opciones oficiales de ARCA), CUIT/CUIL, DNI, razón social, mail y notas. Panel expandible con todos los datos copiables. Resumen del último pago para agilizar la emisión de facturas. Monto formateado para ARCA (sin puntos). Botones de acción directa:
- **Facturar en ARCA** — abre el portal de AFIP
- **Enviar factura** por mail — abre el cliente de correo con asunto, destinatario y texto pre-cargado
- **Enviar factura** por WhatsApp — envía mensaje con datos del período directo al inquilino

### 💡 Impuestos y Servicios
Registro de gastos mensuales por categoría (luz, gas, seguros, mantenimiento, municipales, etc.). Total mensual automático.

### 👥 Lista de espera
Personas interesadas en alquilar. Nombre, WhatsApp, notas y fecha de ingreso. Contacto directo con un click.

### 🔧 Mantenimiento
Directorio de proveedores y prestadores de servicios. Nombre, rubro, WhatsApp y notas.

### 🔔 Recordatorios
Alertas configurables para controles periódicos (matafuegos, ascensores, etc.). Estados: al día, próximo a vencer o vencido. Notificación automática al abrir la app. Badge de alerta en el menú lateral.

### 📝 Notas
Lista de tareas internas. Agregar con Enter o botón. Marcar como completadas. Filtros: pendientes / todas / completadas.

### 💾 Backup
Exportación completa en Excel (10 hojas) e importación desde Excel. Exportación e importación en JSON. Recordatorio automático cada 30 días. Fecha del último backup sincronizada entre dispositivos vía Firebase.

---

## Características generales

- **Acceso protegido** — usuario y contraseña individual por administrador
- **Multiusuario** — los administradores ven los mismos datos en tiempo real
- **100% responsive** — funciona igual en celular, tablet y PC
- **Sin instalación** — funciona directo desde el navegador
- **Tema claro** — interfaz limpia, moderna y sin distracciones
- **Cierre de sesión con confirmación** — muestra el nombre del usuario que cierra

---

## Tecnología

| Componente | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Base de datos | Firebase Realtime Database |
| Autenticación | Firebase Authentication |
| Imágenes | Cloudinary |
| Hosting | GitHub Pages |
| Exportación Excel | SheetJS |
| Generación de imágenes | html2canvas |

---

## Acceso

`https://jpedemonte77.github.io/JPSoft-Cocheras/`

Funciona en cualquier navegador moderno. No requiere instalación.

---

*JPSoft Cocheras — Gestión simple, control total.*
