const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");
const {defineSecret} = require("firebase-functions/params");

// Definir secrets de configuración
const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");

initializeApp();

// Cloud Function que envía email cuando se crea una nueva notificación
exports.sendNotificationToAdmin = onDocumentCreated(
    {
      document: "notifications/{notificationId}",
      secrets: [gmailEmail, gmailPassword],
    },
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
          to: "inaviciba@gmail.com",
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

// Cloud Function que envía email cuando se crea una nueva sugerencia
exports.sendSuggestionEmail = onDocumentCreated(
    {
      document: "suggestions/{suggestionId}",
      secrets: [gmailEmail, gmailPassword],
    },
    async (event) => {
      const suggestion = event.data.data();

      try {
        logger.info("Nueva sugerencia detectada:", suggestion);

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
          from: `"MAXGYM Sugerencias" <${gmailEmail.value()}>`,
          to: "inaviciba@gmail.com",
          subject: "💡 Nueva sugerencia para MAXGYM App",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏋️‍♂️ MAXGYM</h1>
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">💡 Nueva Sugerencia</h2>
                
                <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                  <p style="margin: 5px 0; color: #555;"><strong>Usuario:</strong> ${suggestion.userName}</p>
                  <p style="margin: 5px 0; color: #555;"><strong>Email:</strong> ${suggestion.userEmail}</p>
                </div>
                
                <div style="background: #fff9e6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffd700;">
                  <h3 style="color: #333; margin-top: 0;">Sugerencia:</h3>
                  <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${suggestion.suggestion}</p>
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
        logger.info("Email de sugerencia enviado correctamente:", info.messageId);

        return {success: true, messageId: info.messageId};
      } catch (error) {
        logger.error("Error al enviar email de sugerencia:", error);
        return {success: false, error: error.message};
      }
    },
);

// Cloud Function para restablecer la contraseña de un usuario
exports.resetUserPassword = onCall(async (request) => {
  try {
    // Verificar que el usuario que llama sea admin (max@max.es)
    if (!request.auth) {
      throw new Error("No autenticado");
    }

    const callerEmail = request.auth.token.email;
    if (callerEmail !== "max@max.es") {
      throw new Error("No tienes permisos para realizar esta acción");
    }

    const {userId, newPassword} = request.data;

    // Validar parámetros
    if (!userId || !newPassword) {
      throw new Error("userId y newPassword son obligatorios");
    }

    if (newPassword.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    // Actualizar la contraseña usando Firebase Admin SDK
    await getAuth().updateUser(userId, {
      password: newPassword,
    });

    logger.info(`Contraseña actualizada correctamente para usuario: ${userId}`);

    return {
      success: true,
      message: "Contraseña actualizada correctamente",
    };
  } catch (error) {
    logger.error("Error al restablecer contraseña:", error);
    throw error;
  }
});

// Cloud Function para enviar email de bienvenida a nuevo usuario
exports.sendWelcomeEmail = onCall(
    {
      secrets: [gmailEmail, gmailPassword],
    },
    async (request) => {
      try {
        // Verificar que el usuario que llama sea admin (max@max.es)
        if (!request.auth) {
          throw new Error("No autenticado");
        }

        const callerEmail = request.auth.token.email;
        if (callerEmail !== "max@max.es") {
          throw new Error("No tienes permisos para realizar esta acción");
        }

        const {userEmail, userName} = request.data;

        // Validar parámetros
        if (!userEmail || !userName) {
          throw new Error("userEmail y userName son obligatorios");
        }

        // Configurar transporte de email con Gmail
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: gmailEmail.value(),
            pass: gmailPassword.value(),
          },
        });

        // Configurar el email de bienvenida
        const mailOptions = {
          from: `"MAXGYM" <${gmailEmail.value()}>`,
          to: userEmail,
          subject: "¡Bienvenido a MAXGYM! 🏋️‍♂️",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
                <div style="background: white; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 40px;">🏋️‍♂️</span>
                </div>
                <h1 style="color: white; margin: 0; font-size: 32px;">¡Bienvenido a MAXGYM!</h1>
              </div>
              
              <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">Hola ${userName} 👋</h2>
                
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                  Tu cuenta en MAXGYM ha sido creada exitosamente. Ahora puedes acceder a la aplicación y comenzar a registrar tus entrenamientos.
                </p>

                <div style="background: #fff8dc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ff9800;">
                  <h3 style="color: #ff9800; margin-top: 0; font-size: 18px;">⚠️ Importante: Cambio de Contraseña</h3>
                  <p style="color: #666; margin: 0; line-height: 1.6;">
                    Tu contraseña inicial es <strong style="color: #333;">000000</strong> (seis ceros).<br><br>
                    Por tu seguridad, <strong>te recomendamos cambiarla en tu primer inicio de sesión</strong>.
                  </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="http://localhost:3000" 
                     style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; 
                            font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                    Acceder a MAXGYM
                  </a>
                </div>

                <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 30px;">
                  <h3 style="color: #333; margin-top: 0; font-size: 16px;">📧 Tus credenciales</h3>
                  <p style="color: #666; margin: 5px 0;">
                    <strong>Email:</strong> ${userEmail}
                  </p>
                  <p style="color: #666; margin: 5px 0;">
                    <strong>Contraseña temporal:</strong> 000000
                  </p>
                </div>

                <p style="color: #999; font-size: 14px; margin-top: 30px; text-align: center;">
                  Si tienes alguna pregunta, no dudes en contactarnos.<br>
                  ¡Disfruta de tu entrenamiento! 💪
                </p>
              </div>

              <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                <p style="margin: 0;">© 2025 MAXGYM - Tu compañero de entrenamiento</p>
              </div>
            </div>
          `,
        };

        // Enviar el email
        const info = await transporter.sendMail(mailOptions);
        logger.info("Email de bienvenida enviado:", info.messageId);

        return {
          success: true,
          message: "Email de bienvenida enviado correctamente",
        };
      } catch (error) {
        logger.error("Error al enviar email de bienvenida:", error);
        throw error;
      }
    });
