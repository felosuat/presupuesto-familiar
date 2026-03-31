# Presupuesto Familiar 🏠

App de presupuesto compartido para la Familia Elosua.

---

## Paso 1 — Configurar Firebase (5 min)

1. Ve a https://console.firebase.google.com y crea un proyecto nuevo  
   → Nombre: `presupuesto-familiar` (o el que quieras)

2. En el menú izquierdo, haz click en **Firestore Database** → **Crear base de datos**  
   → Modo: Producción  
   → Región: `us-central1`

3. Ve a ⚙️ **Configuración del proyecto** → **Tus apps** → botón `</>`  
   → Registra la app web, copia el objeto `firebaseConfig`

4. Abre el archivo `src/firebase.js` y reemplaza los valores de `firebaseConfig`

5. En Firestore → **Reglas**, pega esto y publica:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## Paso 2 — Subir a Vercel (3 min)

1. Sube esta carpeta a GitHub (o usa la CLI de Vercel directamente)
2. Ve a https://vercel.com → **New Project** → importa el repositorio
3. Vercel detecta automáticamente que es Vite → click en **Deploy**
4. En ~2 minutos tienes tu URL pública

---

## Paso 3 — Instalar en iPhone como PWA

1. Abre la URL en **Safari** (importante: Safari, no Chrome)
2. Toca el botón compartir (⬆️)
3. Selecciona **"Agregar a pantalla de inicio"**
4. Listo — aparece como app nativa en tu home screen

Comparte la URL con tu esposa para que haga lo mismo.  
Ambos verán los datos en tiempo real gracias a Firebase.

---

## Desarrollo local

```bash
npm install
npm run dev
```
