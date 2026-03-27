const express = require('express');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// GET = usado pela Meta para verificar o webhook
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

// POST = usado pela Meta para enviar eventos/mensagens
app.post('/', (req, res) => {
  console.log('--- POST recebido ---');
  console.log(JSON.stringify(req.body, null, 2));

  return res.status(200).json({ status: 'received' });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
