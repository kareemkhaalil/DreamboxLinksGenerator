const express = require("express");
const fileUpload = require("express-fileupload");
const AdmZip = require("adm-zip");
const ExcelJS = require("exceljs");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware لتمكين رفع الملفات
app.use(fileUpload());

// خدمة الملفات الثابتة من مجلد assets
app.use("/assets", express.static(path.join(__dirname, "../assets")));

// صفحة الرفع
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "upload.html"));
});

// معالجة الرفع
app.post("/upload", (req, res) => {
  if (!req.files || !req.files.zipFile) {
    return res.status(400).send("لم يتم رفع أي ملف.");
  }

  const zipFile = req.files.zipFile;
  const zip = new AdmZip(zipFile.data);
  const zipEntries = zip.getEntries(); // الحصول على الملفات داخل الـ ZIP

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Image Links");

  // إضافة عناوين الأعمدة
  worksheet.columns = [
    { header: "اسم الصورة", key: "name", width: 30 },
    { header: "الرابط", key: "url", width: 50 },
  ];

  let progress = 0;
  const totalFiles = zipEntries.length;

  // إرسال التقدم إلى الواجهة
  const sendProgress = () => {
    io.emit("progress", { progress, totalFiles });
  };

  // إضافة البيانات
  zipEntries.forEach((entry, index) => {
    if (!entry.isDirectory) {
      const imageName = entry.entryName;
      const imageUrl = `https://app.dreamboxmalls.com/storage/app/public/product/${imageName}`;
      worksheet.addRow({ name: imageName, url: imageUrl });

      // تحديث التقدم
      progress = ((index + 1) / totalFiles) * 100;
      sendProgress();

      // إرسال بيانات الصورة إلى الواجهة
      io.emit("image-added", { name: imageName, url: imageUrl });
    }
  });

  // حفظ ملف Excel
  const excelFilePath = path.join(__dirname, "image_links.xlsx");
  workbook.xlsx
    .writeFile(excelFilePath)
    .then(() => {
      res.download(excelFilePath); // تنزيل الملف
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("حدث خطأ أثناء إنشاء الملف.");
    });
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`الخادم يعمل على http://localhost:${PORT}`);
});