const express = require('express');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

const processedMessages = new Set();

setInterval(() => {
  if (processedMessages.size > 1000) {
    processedMessages.clear();
    console.log('Cache de mensagens processadas foi limpo.');
  }
}, 60 * 60 * 1000);

app.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];

  console.log('--- GET recebido ---');
  console.log('mode:', mode);
  console.log('challenge:', challenge);
  console.log('token:', token);

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Token inválido');
});

async function sendWhatsAppText(to, text) {
  if (!whatsappToken || !phoneNumberId) {
    throw new Error('WHATSAPP_TOKEN ou PHONE_NUMBER_ID não configurados.');
  }

  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body: text
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${whatsappToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  console.log('--- RESPOSTA DA META AO ENVIAR MENSAGEM ---');
  console.log(JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(`Erro ao enviar mensagem: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function processIncomingMessage(body) {
  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  const contact = value?.contacts?.[0];
  const message = value?.messages?.[0];
  const status = value?.statuses?.[0];

  // NOVO: tratar status de mensagens enviadas
  if (status) {
    console.log('--- STATUS RECEBIDO ---');
    console.log('message_id:', status?.id || 'sem_id');
    console.log('status:', status?.status || 'sem_status');
    console.log('recipient_id:', status?.recipient_id || 'sem_recipient_id');
    console.log('timestamp:', status?.timestamp || 'sem_timestamp');

    if (status?.errors?.length) {
      console.log('errors:', JSON.stringify(status.errors, null, 2));
    }

    return;
  }

  if (!message) {
    console.log('Nenhuma mensagem encontrada neste evento.');
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  const messageId = message?.id || 'sem_id';
  const nome = contact?.profile?.name || 'Sem nome';
  const waId = contact?.wa_id || 'Sem wa_id';
  const from = message?.from || 'Sem remetente';
  const type = message?.type || 'tipo_desconhecido';

  if (processedMessages.has(messageId)) {
    console.log('Mensagem duplicada ignorada. ID:', messageId);
    return;
  }

  processedMessages.add(messageId);

  let textoRecebido = '';

  if (type === 'text') {
    textoRecebido = message?.text?.body || '';
  } else if (type === 'interactive') {
    textoRecebido =
      message?.interactive?.button_reply?.title ||
      message?.interactive?.list_reply?.title ||
      'Mensagem interativa recebida';
  } else {
    textoRecebido = `Mensagem recebida do tipo: ${type}`;
  }

  console.log('--- MENSAGEM PROCESSADA ---');
  console.log('messageId:', messageId);
  console.log('Nome:', nome);
  console.log('wa_id:', waId);
  console.log('from:', from);
  console.log('type:', type);
  console.log('textoRecebido:', textoRecebido);

  if (type === 'text') {
    await sendWhatsAppText(from, 'Olá! Recebi sua mensagem 😊');
  }
}

app.post('/', (req, res) => {
  console.log('--- POST recebido ---');

  res.status(200).json({ status: 'received_fast' });

  setImmediate(async () => {
    try {
      await processIncomingMessage(req.body);
    } catch (error) {
      console.error('Erro ao processar mensagem em background:', error);
    }
  });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
