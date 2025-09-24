const express = require("express");
const xlsx = require("xlsx");
const bodyParser = require("body-parser");
const cors = require("cors");
const stringSimilarity = require("string-similarity");
const unorm = require("unorm");
const session = require('express-session');
const path = require("path");


const app = express();
// --- START: login session (THÊM, KHÔNG SỬA phần khác) ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || "chatbot-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 ngày
  })
);
// --- END: login session ---

const PORT = 10000;

app.use(bodyParser.json());
app.use(cors());

// --- START: routes cho Login (THÊM, KHÔNG SỬA phần khác) ---
app.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  // TODO: đổi credential này theo yêu cầu của bạn hoặc kết nối DB sau này
  const validUser = username === "admin" && password === "123456";

  if (validUser) {
    req.session.user = { username }; // lưu session đơn giản
    return res.json({ success: true });
  } else {
    return res.json({ success: false, message: "Sai username hoặc password" });
  }
});

// Logout (truy cập GET để redirect về login)
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    // ignore err, redirect về login
    return res.redirect("/login.html");
  });
});

// Bảo vệ truy cập index (chỉ redirect, KHÔNG can thiệp code index.html)
app.get(["/", "/index.html"], (req, res) => {
  if (req.session && req.session.user) {
    // Nếu đã login, trả index.html (giữ nguyên file index.html trong public)
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  } else {
    // Nếu chưa login => redirect về trang login
    return res.redirect("/login.html");
  }
});
// --- END: routes cho Login ---

app.use(express.static("public"));

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

// API: Gợi ý (chứa từ khóa)
app.get("/api/suggest", (req, res) => {
  const q = normalizeText(req.query.q || "");
  if (!q) return res.json([]);
  const results = faq
    .filter((item) => normalizeText(item.question).includes(q))
    .slice(0, 5)
    .map((item) => item.question);
  res.json(results);
});

// API: Hỏi đáp (Fuzzy Search)
app.post("/api/ask", (req, res) => {
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
      .filter((item) => item.score >= 0.3) // chỉ giữ lại câu hỏi có độ giống ≥ 30%
      .sort((a, b) => b.score - a.score)
      .map((r) => r.question);
    res.json({ answer: null, suggestions });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
