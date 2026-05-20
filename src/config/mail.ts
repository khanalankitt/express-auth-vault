import nodemailer, { type Transporter } from "nodemailer";
import env from "./env";

let transporter: Transporter | null = null;

if (env.MAIL_HOST && env.MAIL_PORT) {
  transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_PORT === 465,
    auth:
      env.MAIL_USER && env.MAIL_PASS
        ? { user: env.MAIL_USER, pass: env.MAIL_PASS }
        : undefined,
  });
}

export default transporter;
