document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const messages = document.getElementById("chat-messages");
  const suggestionsBox = document.getElementById("suggestions");

  // Thêm tin nhắn
  function addMessage(text, sender) {
    const div = document.createElement("div");
    div.className = `message ${sender}`;
    div.innerText = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // Lấy gợi ý
  async function fetchSuggestions(query) {
    if (!query) {
      suggestionsBox.style.display = "none";
      return;
    }
    try {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      suggestionsBox.innerHTML = "";
      if (data.length > 0) {
        data.forEach(item => {
          const div = document.createElement("div");
          div.className = "suggestion-item";
          div.textContent = item;
          div.addEventListener("click", () => {
            input.value = item;
            suggestionsBox.style.display = "none";
            form.dispatchEvent(new Event("submit"));
          });
          suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = "block";
      } else {
        suggestionsBox.style.display = "none";
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    }
  }

  input.addEventListener("input", () => {
    fetchSuggestions(input.value);
  });

  // Gửi câu hỏi
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    addMessage(question, "user");
    input.value = "";
    suggestionsBox.style.display = "none";

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      if (data.answer) {
        addMessage(data.answer, "bot");
      } else if (data.suggestions && data.suggestions.length > 0) {
        addMessage("Bạn có muốn hỏi:", "bot");
        data.suggestions.forEach(s => addMessage("- " + s, "bot"));
      } else {
        addMessage("Xin lỗi, tôi chưa có câu trả lời.", "bot");
      }
    } catch (err) {
      console.error("Error asking question:", err);
      addMessage("Có lỗi xảy ra khi gửi câu hỏi.", "bot");
    }
  });
});
