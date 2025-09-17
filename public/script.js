const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatBox = document.getElementById('chat-box');

function addMessage(text, sender){
  const el = document.createElement('div');
  el.className = 'msg ' + (sender==='user'?'user':'bot');
  el.innerHTML = text;
  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage(){
  const question = input.value.trim();
  if(!question) return;
  addMessage(question, 'user');
  input.value = '';
  try{
    const res = await fetch('/api/ask', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ question })
    });
    if(!res.ok){ addMessage('❌ Lỗi server', 'bot'); return; }
    const data = await res.json();
    addMessage(data.answer, 'bot');
  }catch(err){
    addMessage('❌ Lỗi kết nối tới server', 'bot');
  }
}

sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keypress', (e)=>{ if(e.key==='Enter'){ sendMessage(); } });
