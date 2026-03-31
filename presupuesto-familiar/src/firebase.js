// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCCIONES:
// 1. Ve a https://console.firebase.google.com
// 2. Crea un nuevo proyecto (ej. "presupuesto-familiar")
// 3. En el proyecto, ve a "Firestore Database" > "Crear base de datos"
//    - Selecciona modo "Producción"
//    - Elige región "us-central1" o "nam5"
// 4. Ve a Configuración del proyecto (ícono ⚙️) > "Tus apps" > agrega app Web (</>)
// 5. Copia los valores de firebaseConfig y pégalos abajo
// 6. En Firestore > Reglas, pega esto y publica:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} {
//          allow read, write: if true;
//        }
//      }
//    }
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
apiKey: "AIzaSyADfPFCacp6LS6AyN8C7-ord6reLp08IZw",
  authDomain: "planeacion-presupuesto-2026.firebaseapp.com",
  projectId: "planeacion-presupuesto-2026",
  storageBucket: "planeacion-presupuesto-2026.firebasestorage.app",
  messagingSenderId: "118224586184",
  appId: "1:118224586184:web:bee0108171532c9e9d6cfd",
  measurementId: "G-YNWP3ZLGH1"
};

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
