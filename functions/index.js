const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

initializeApp();

// Cloud Function que se ejecuta cuando se crea una nueva notificación
exports.sendNotificationToAdmin = onDocumentCreated(
    "notifications/{notificationId}",
    async (event) => {
      const notification = event.data.data();

      try {
        logger.info("Nueva notificación detectada:", notification);

        // Obtener el token FCM del admin (max@max.es)
        const db = getFirestore();
        const usersSnapshot = await db
            .collection("users")
            .where("email", "==", "max@max.es")
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
          logger.warn("Admin user not found");
          return null;
        }

        const adminDoc = usersSnapshot.docs[0];
        const adminData = adminDoc.data();
        const fcmToken = adminData.fcmToken;

        if (!fcmToken) {
          logger.warn("Admin doesn't have FCM token");
          return null;
        }

        // Preparar el mensaje de notificación
        const message = {
          notification: {
            title: "📬 Nueva solicitud de cambio",
            body: `${notification.userName} solicita cambios en su tabla`,
          },
          data: {
            type: notification.type || "table_change_request",
            userId: notification.userId || "",
            userName: notification.userName || "",
          },
          token: fcmToken,
        };

        // Enviar la notificación
        const messaging = getMessaging();
        const response = await messaging.send(message);
        logger.info("Successfully sent notification:", response);

        return response;
      } catch (error) {
        logger.error("Error sending notification:", error);
        return null;
      }
    },
);
