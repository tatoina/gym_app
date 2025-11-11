const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");
const {defineString} = require("firebase-functions/params");

// Definir parámetros de configuración
const gmailEmail = defineString("GMAIL_EMAIL");
const gmailPassword = defineString("GMAIL_PASSWORD");

initializeApp();

// Cloud Function que envía email cuando se crea una nueva notificación
exports.sendNotificationToAdmin = onDocumentCreated(
    "notifications/{notificationId}",
    async (event) => {
      const notification = event.data.data();

      try {
        logger.info("Nueva notificación detectada:", notification);

        // Configurar transporte de email con Gmail
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: gmailEmail.value(),
            pass: gmailPassword.value(),
          },
        });

        // Configurar el email
        const mailOptions = {
          from: `"MAXGYM Notificaciones" <${gmailEmail.value()}>`,
          to: "max@max.es",
          subject: "📬 Nueva solicitud de cambio en MAXGYM",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏋️‍♂️ MAXGYM</h1>
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">Nueva Solicitud de Cambio</h2>
                
                <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 5px 0; color: #555;"><strong>Usuario:</strong> ${notification.userName}</p>
                  <p style="margin: 5px 0; color: #555;"><strong>Email:</strong> ${notification.userEmail}</p>
                  <p style="margin: 15px 0 5px 0; color: #333;"><strong>Comentario:</strong></p>
                  <p style="margin: 5px 0; color: #666; font-style: italic; background: white; padding: 15px; border-radius: 5px;">
                    "${notification.comment || "Sin comentario"}"
                  </p>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                  <a href="https://gymapp-bd0da.web.app" 
                     style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            padding: 15px 30px; 
                            text-decoration: none; 
                            border-radius: 25px; 
                            display: inline-block;
                            font-weight: bold;
                            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                    📱 Abrir Panel de Administración
                  </a>
                </div>

                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                  Este es un mensaje automático de MAXGYM. No respondas a este email.
                </p>
              </div>
            </div>
          `,
        };

        // Enviar el email
        const info = await transporter.sendMail(mailOptions);
        logger.info("Email enviado correctamente:", info.messageId);

        return {success: true, messageId: info.messageId};
      } catch (error) {
        logger.error("Error al enviar email:", error);
        return {success: false, error: error.message};
      }
    },
);
