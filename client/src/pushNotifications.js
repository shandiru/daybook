import { api } from "./api.js";

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function canUsePushNotifications() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function enablePushNotifications() {
  if (!canUsePushNotifications()) throw new Error("Push notifications are not supported on this device");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not allowed");

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushPublicKey();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api.savePushSubscription(subscription.toJSON());
  localStorage.setItem("push-enabled", "true");
  return subscription;
}

export async function syncPushSubscription() {
  if (!canUsePushNotifications() || Notification.permission !== "granted") {
    localStorage.removeItem("push-enabled");
    return false;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    localStorage.removeItem("push-enabled");
    return false;
  }
  await api.savePushSubscription(subscription.toJSON());
  localStorage.setItem("push-enabled", "true");
  return true;
}
