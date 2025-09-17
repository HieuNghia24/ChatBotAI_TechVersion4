import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import xlsx from "xlsx";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Load FAQ safely
let faqs = [];
function loadFaq(){
  try{
    const filePath = path.join(__dirname, "faq.xlsx");
    if (!fs.existsSync(filePath)) {
      console.warn("faq.xlsx not found at", filePath);
      faqs = [];
      return;
    }
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    faqs = xlsx.utils.sheet_to_json(sheet);
    console.log(`✅ Loaded ${faqs.length} FAQ rows from ${filePath}`);
  }catch(err){
    console.error("Error loading faq.xlsx:", err.message);
    faqs = [];
  }
}
loadFaq();

app.get("/ping", (req,res) => res.json({ok:true}));

// POST /api/ask - find best match (contains)
app.post("/api/ask", (req, res) => {
  const question = (req.body?.question || "").toString().trim().toLowerCase();
  if(!question) return res.json({ answer: "Vui lòng nhập câu hỏi." });

  // Exact contains match on 'question' column (case-insensitive)
  let answer = null;
  for (const row of faqs) {
    if (!row.question) continue;
    try {
      const q = row.question.toString().toLowerCase();
      if (question.includes(q) || q.includes(question)) {
        answer = row.answer || "";
        break;
      }
    } catch(e){ continue; }
  }

  if (!answer) answer = "Xin lỗi, tôi chưa có câu trả lời phù hợp.";

  return res.json({ answer });
});

// reload endpoint
app.get("/api/reload-faq", (req,res)=>{
  loadFaq();
  res.json({ok:true, count: faqs.length});
});

// serve index


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});








