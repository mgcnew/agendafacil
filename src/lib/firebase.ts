"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";
import { createClient } from "@/lib/supabase/client";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;
  return getMessaging(getFirebaseApp());
}

export type PushPermissionResult = "granted" | "denied" | "unsupported";

/**
 * Pede permissão de notificação, reaproveita o service worker do PWA (não
 * registra um segundo) e grava o token do dispositivo em push_subscriptions.
 */
export async function requestPushPermission(salonId: string): Promise<PushPermissionResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return "unsupported";

  const messaging = await getMessagingInstance();
  if (!messaging) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return "denied";

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "unsupported";

  await supabase
    .from("push_subscriptions")
    .upsert(
      { salon_id: salonId, profile_id: user.id, token, updated_at: new Date().toISOString() },
      { onConflict: "salon_id,token" },
    );

  return "granted";
}

/** Notificação em primeiro plano (aba aberta) — FCM não mostra sozinho, então avisamos via callback (ex.: toast). */
export async function onForegroundPush(cb: (title: string, body: string) => void): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "Notificação";
    const body = payload.notification?.body ?? "";
    cb(title, body);
  });
}
