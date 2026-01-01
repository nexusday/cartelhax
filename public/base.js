import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import {
  getDatabase,
  ref,
  set,
  get,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBEQbJpWY0HBKvl71Ti_su0Mm0MoLSQl6I",
  authDomain: "lolifya-app.firebaseapp.com",
  databaseURL: "https://lolifya-app-default-rtdb.firebaseio.com",
  projectId: "lolifya-app",
  storageBucket: "lolifya-app.firebasestorage.app",
  messagingSenderId: "632721091270",
  appId: "1:632721091270:web:643522d29321972d5385c7",
  measurementId: "G-P4KD837FB1",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let analytics = null;
isAnalyticsSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch(() => {
    
  });

export { app, db, analytics, ref, set, get };
