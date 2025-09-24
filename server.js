const express = require("express");
const xlsx = require("xlsx");
const bodyParser = require("body-parser");
const cors = require("cors");
const stringSimilarity = require("string-similarity");
const unorm = require("unorm");
const session = require("express-session"); // Thêm session

const app = express();
const PORT = 10000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.urlencoded({ extended: true })); // để đọc form login
app.use(express.static("public"));

// Cấu hình session
app.use(
  session({
    secret: "mySecretKey", // đổi thành chuỗi bảo mật riêng
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Để true nếu deploy HTTPS
  })
);

// Middleware kiểm tra login
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    next(); // đã login
  } else {
    res.redirect("/login.html"); // chưa login -> về trang login
  }
}

// Chuẩn hóa chuỗi (không phân biệt hoa/thường, có dấu/không dấu)
function normalizeText(str) {
  return unorm
    .nfd(str.toLowerCase())
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Load FAQ từ Excel
let faq = [];
function loadFAQ() {
  try {
    const workbook = xlsx.readFile("faq.xlsx");
    const sheetName = workbook.SheetNames[0];
    const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    faq = sheet
      .map((row) => ({
        question: String(row.question || row.Question || "").trim(),
        answer: String(row.answer || row.Answer || "").trim(),
      }))
      .filter((q) => q.question && q.answer);
    console.log(`✅ Loaded ${faq.length} FAQ items`);
  } catch (err) {
    console.error("❌ Error reading faq.xlsx:", err);
  }
}
loadFAQ();

// ---------------- LOGIN ----------------

// Xử lý POST login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Tài khoản mẫu (có thể thay bằng DB)
  if (username === "admin" && password === "123456") {
    req.session.user = username;
    res.redirect("/"); // login thành công -> vào chatbot
  } else {
    res.redirect("/login.html?error=1"); // login sai -> về login
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// ---------------- CHATBOT ----------------

// API: Gợi ý (chứa từ khóa)
app.get("/api/suggest", requireLogin, (req, res) => {
  const q = normalizeText(req.query.q || "");
  if (!q) return res.json([]);
  const results = faq
    .filter((item) => normalizeText(item.question).includes(q))
    .slice(0, 5)
    .map((item) => item.question);
  res.json(results);
});

// API: Hỏi đáp (Fuzzy Search)
app.post("/api/ask", requireLogin, (req, res) => {
  const { question } = req.body;
  if (!question) return res.json({ answer: "Xin lỗi, tôi chưa hiểu câu hỏi." });

  const q = normalizeText(question);

  let bestMatch = null;
  let bestScore = 0;
  faq.forEach((item) => {
    const score = stringSimilarity.compareTwoStrings(
      q,
      normalizeText(item.question)
    );
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  });

  const threshold = 0.7; // 70% match coi là đúng
  if (bestMatch && bestScore >= threshold) {
    res.json({ answer: bestMatch.answer });
  } else {
    const suggestions = faq
      .map((item) => ({
        question: item.question,
        score: stringSimilarity.compareTwoStrings(
          q,
          normalizeText(item.question)
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => r.question);
    res.json({ answer: null, suggestions });
  }
});

// Giao diện chatbot (chặn login)
app.get("/", requireLogin, (req, res) => {
  res.sendFile(__dirname + "/public/chat.html");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
