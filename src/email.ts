
import nodemailer from "nodemailer";
import { eventsConfig } from "./shared/schema";

interface EmailPayload {
  to: string;
  fullName: string;
  registrationId: string;
  eventName: string;
}

export async function sendConfirmationEmail(payload: EmailPayload) {
  try {
    // Check if credentials exist
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("Email configuration missing. Skipping email.");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const event = eventsConfig[payload.eventName as keyof typeof eventsConfig];
    const eventDisplayName = event ? event.title : payload.eventName;

    const mailOptions = {
      from: '"INNIXO - Future Tech Motion" <no-reply@innixo.com>', // Customize
      to: payload.to,
      subject: `Registration Confirmed: ${eventDisplayName}`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #008751; text-align: center;">Registration Confirmed!</h2>
            <p>Dear <strong>${payload.fullName}</strong>,</p>
            <p>Thank you for registering for <strong>${eventDisplayName}</strong> at INNIXO - OVERDRIVE 2026.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #008751; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Registration ID:</strong> ${payload.registrationId}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> DRAFT (Pending Payment)</p>
            </div>

            <p>Please keep this ID safe for future reference and payment validation at the venue.</p>
            
            <p>Best Regards,<br>Team INNIXO</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false; // Don't throw, just log
  }
}
