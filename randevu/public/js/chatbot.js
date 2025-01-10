// chatbot.js

// Elemanları seçelim
const chatbotButton = document.getElementById('chatbot-button');
const chatbotWindow = document.getElementById('chatbot-window');
const closeChatbot = document.getElementById('close-chatbot');
const sendButton = document.getElementById('send-button');
const userInput = document.getElementById('user-input');
const chatbotBody = document.getElementById('chatbot-body');

// 1) Chatbot Penceresini Açma / Kapatma
chatbotButton.addEventListener('click', () => {
  // .show sınıfını ekleyerek görünür ve animasyonlu hale getiriyoruz
  chatbotWindow.classList.toggle('show');
});

closeChatbot.addEventListener('click', () => {
  chatbotWindow.classList.remove('show');
});

// 2) Mesaj Gönderme Fonksiyonu
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

function sendMessage() {
  const message = userInput.value.trim();
  if (message === '') return;

  // Kullanıcı mesajını ekrana yaz
  appendMessage('user', message);

  // Metin kutusunu sıfırla
  userInput.value = '';

  // Bot yanıtını 1 sn gecikmeyle verelim
  setTimeout(() => {
    const botReply = getBotResponse(message);
    appendMessage('bot', botReply);
  }, 1000);
}

// 3) Mesaj Ekleme (user or bot)
function appendMessage(sender, text) {
  // Gönderici türüne göre div oluştur
  const messageDiv = document.createElement('div');
  if (sender === 'user') {
    messageDiv.classList.add('user-message');
  } else {
    messageDiv.classList.add('bot-message');
  }
  // Mesaj <p> etiketi
  const messageP = document.createElement('p');
  messageP.textContent = text;
  messageDiv.appendChild(messageP);

  // Gövdeye ekle
  chatbotBody.appendChild(messageDiv);

  // Scroll’u en alta çek
  chatbotBody.scrollTop = chatbotBody.scrollHeight;
}

// 4) Bot Yanıt Mantığı (Regex + switch-case)
function getBotResponse(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  switch(true) {
    // Merhaba - Selam - Hey
    case /merhaba|selam|hey/.test(msg):
      return 'Merhaba! Size nasıl yardımcı olabilirim?';

    // Randevu (randev, randevu, randevü, randevi...)
    case /randev(?:u|ü|i)/i.test(msg):
      if (/iptal/i.test(msg)) {
        return 'Randevunuzu iptal etmek için hesap panelinizden "Randevularım" bölümünü ziyaret edebilirsiniz.';
      } else if (/oluştur|almak|yeni/i.test(msg)) {
        return 'Yeni randevu oluşturmak için lütfen "Randevu Al" sayfamıza gidin veya 444 0 000 numaralı telefondan bize ulaşın.';
      } else {
        return 'Randevu hakkında iptal veya oluşturma gibi bir işlem mi yapmak istiyorsunuz?';
      }

    // Departman veya Bölüm
    case /departman|bölüm/i.test(msg):
      return 'Departmanlarımız hakkında bilgi almak için web sitemizi ziyaret edebilir veya 444 0 000 numaralı telefondan bize ulaşabilirsiniz.';

    // Teşekkür vb.
    case /teşekkür|sağol|thanks|thank you/i.test(msg):
      return 'Rica ederim! Başka bir konuda yardımcı olabilir miyim?';

    // Default
    default:
      return 'Üzgünüm, bu konuda yardımcı olamıyorum. Detaylı bilgi için web sitemizi inceleyebilir veya yetkililerimizle iletişime geçebilirsiniz.';
  }
}
