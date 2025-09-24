const express = require("express");
const session = require("express-session");
const path = require("path");
const xlsx = require("xlsx");
const stringSimilarity = require("string-similarity");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: "chatbot-secret",
    resave: false,
    saveUninitialized: true,
  })
);

// Load FAQ từ file Excel
const workbook = xlsx.readFile(path.join(__dirname, "faq.xlsx"));
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const faq = xlsx.utils.sheet_to_json(sheet);

// Hàm chuẩn hóa text
function normalizeText(text) {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Middleware kiểm tra login
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect("/login.html");
  }
}

// API: login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Demo: user/pass fix cứng
  if (username === "admin" && password === "123456") {
    req.session.user = username;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// API: trả lời câu hỏi chính xác/ gần đúng
app.get("/api/ask", (req, res) => {
  const q = normalizeText(req.query.q || "");
  if (!q) return res.json({ answer: "Bạn chưa nhập câu hỏi." });

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
    res.json({ answer: "Xin lỗi, tôi chưa có câu trả lời phù hợp." });
  }
});

// API: gợi ý câu hỏi
app.get("/api/suggest", (req, res) => {
  const q = normalizeText(req.query.q || "");
  if (!q) return res.json([]);
  const results = faq
    .map((item) => ({
      question: item.question,
      score: stringSimilarity.compareTwoStrings(
        q,
        normalizeText(item.question)
      ),
    }))
    .filter((item) => item.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.question);

  res.json(results); // trả tất cả thay vì chỉ 5
});

// Cho phép login.html truy cập không cần session
app.use("/login.html", express.static(path.join(__dirname, "public", "login.html")));

// Bảo vệ index.html
app.get("/index.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Các static file khác
app.use(express.static(path.join(__dirname, "public")));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));
