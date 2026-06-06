import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";
import multer from "multer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Configure uploads directory (using writeable /tmp partition in Cloud Run serverless container runtime)
  const uploadsDir = "/tmp/uploads";
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadsDir));

  // Configure Multer storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 150 * 1024 * 1024 } // Support uploading videos up to 150MB securely
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // File upload route
  app.post("/api/upload", (req, res) => {
    console.log("Receiving file upload request...");
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer upload error:", err);
        let errorMsg = "حدث خطأ أثناء رفع الملف.";
        if (err.code === "LIMIT_FILE_SIZE") {
          errorMsg = "حجم الملف كبير جداً. الحد الأقصى المسموح به هو 150 ميجابايت.";
        } else if (err.message) {
          errorMsg = `خطأ في الرفع: ${err.message}`;
        }
        return res.status(400).json({ error: errorMsg });
      }

      if (!req.file) {
        console.warn("Upload request had no file.");
        return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع" });
      }

      console.log(`File uploaded successfully: ${req.file.filename}, Size: ${req.file.size} bytes`);
      const fileUrl = `/uploads/${req.file.filename}`;
      return res.json({
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size
      });
    });
  });

  // Chunked file upload route for large files (resilient to proxy and connection timeouts)
  app.post("/api/upload-chunk", (req, res) => {
    upload.single("chunk")(req, res, (err) => {
      if (err) {
        console.error("Multer chunk upload error:", err);
        return res.status(400).json({ error: "فشل رفع قطعة الملف" });
      }

      try {
        const { chunkIndex, totalChunks, filename, uploadId } = req.body;
        if (!req.file) {
          return res.status(400).json({ error: "لم يتم استلام أي قطعة من الملف" });
        }

        const index = parseInt(chunkIndex, 10);
        const total = parseInt(totalChunks, 10);

        if (isNaN(index) || isNaN(total) || !uploadId || !filename) {
          return res.status(400).json({ error: "بيانات مجزأة غير صالحة" });
        }

        // Create temporary directory for this upload ID
        const tempDir = path.join(uploadsDir, "temp", uploadId);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Move uploaded chunk to temp directory with index-based name
        const chunkPath = path.join(tempDir, `chunk-${index}`);
        if (fs.existsSync(chunkPath)) {
          fs.unlinkSync(chunkPath);
        }
        
        try {
          fs.renameSync(req.file.path, chunkPath);
        } catch (renameErr) {
          // Fallback to copy-and-delete if files reside on different filesystems or mounts
          fs.copyFileSync(req.file.path, chunkPath);
          fs.unlinkSync(req.file.path);
        }

        // Check if we have received all chunks
        let receivedChunks = 0;
        for (let i = 0; i < total; i++) {
          if (fs.existsSync(path.join(tempDir, `chunk-${i}`))) {
            receivedChunks++;
          }
        }

        if (receivedChunks === total) {
          // Assemble the chunks
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = path.extname(filename);
          // Keep a clean filename prefix based on file name or simple default
          const cleanBase = path.basename(filename, ext).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, "_");
          const cleanFilename = `${cleanBase}-${uniqueSuffix}${ext}`;
          const finalPath = path.join(uploadsDir, cleanFilename);

          // Append each chunk sequentially to the final file
          for (let i = 0; i < total; i++) {
            const partPath = path.join(tempDir, `chunk-${i}`);
            const buffer = fs.readFileSync(partPath);
            fs.appendFileSync(finalPath, buffer);
            fs.unlinkSync(partPath); // delete individual chunk
          }

          // Clean up the temporary directory
          fs.rmdirSync(tempDir);

          console.log(`Successfully assembled chunked file: ${cleanFilename}`);
          const fileUrl = `/uploads/${cleanFilename}`;
          return res.json({
            url: fileUrl,
            filename: filename,
            completed: true
          });
        }

        return res.json({
          chunkIndex: index,
          completed: false
        });
      } catch (innerErr: any) {
        console.error("Error processing chunk:", innerErr);
        return res.status(500).json({ error: `حدث خطأ أثناء معالجة الجزء المرفوع: ${innerErr.message}` });
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Serve index.html for all other routes in dev
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
