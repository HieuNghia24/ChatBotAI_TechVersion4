const express = require("express");
const xlsx = require("xlsx");
const bodyParser = require("body-parser");
const cors = require("cors");
const stringSimilarity = require("string-similarity");
const unorm = require("unorm");
const session = require("express-session");

const app = express();
const PORT = 10000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

app.use(
  session({
    secret: "mySecretKey", // đổi thành chuỗi bảo mật riêng
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // nếu deploy HTTPS thì để true
  })
);

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

// Tạo Middle Ware kiểm tra đăng nhập
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    next(); // đã login -> cho đi tiếp
  } else {
    res.redirect("/login"); // chưa login -> quay về trang login
  }
}

// Ràng buộc route chatbot
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

// Xử lý POST login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // kiểm tra tài khoản (có thể hardcode hoặc lấy DB)
  if (username === "admin" && password === "123456") {
    req.session.user = username; // lưu user vào session
    res.redirect("/"); // login thành công -> vào chatbot
  } else {
    res.redirect("/login?error=1"); // sai thì quay lại login
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});


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
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => r.question);
    res.json({ answer: null, suggestions });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
