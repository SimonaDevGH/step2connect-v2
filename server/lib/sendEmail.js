/**
 * Invio email tramite AWS SES.
 * Il mittente deve essere verificato in SES (o il dominio deve essere verificato).
 * Configura la variabile d'ambiente SES_FROM_EMAIL con l'indirizzo mittente verificato.
 */
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * @param {object} opts
 * @param {string}   opts.to      - destinatario
 * @param {string}   opts.subject - oggetto
 * @param {string}   opts.html    - corpo HTML
 * @param {string}   [opts.text]  - corpo testo plain (opzionale)
 */
async function sendEmail({ to, subject, html, text }) {
  const from = process.env.SES_FROM_EMAIL;
  if (!from) {
    throw new Error('SES_FROM_EMAIL non configurato. Aggiungi la variabile d\'ambiente con un indirizzo verificato in AWS SES.');
  }

  const cmd = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
        ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
      },
    },
  });

  return ses.send(cmd);
}

module.exports = { sendEmail };
