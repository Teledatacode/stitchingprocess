const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

// Habilita CORS para que pueda recibir peticiones desde cualquier origen
app.use(cors());

// Configura multer para recibir múltiples imágenes
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  res.send("Servidor de stitching activo");
});

app.post("/upload", upload.array("images", 100), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No se recibieron imágenes." });
    }

    // Ordena las imágenes por el nombre (photo0.jpg, photo1.jpg, etc.)
    files.sort((a, b) => a.originalname.localeCompare(b.originalname));

    // Convierte los buffers en imágenes Sharp
    const sharpImages = await Promise.all(
      files.map((file) => sharp(file.buffer).resize({ width: 512 }).toBuffer())
    );

    // Une horizontalmente como prototipo simple
    const composite = sharp({
      create: {
        width: 512 * sharpImages.length,
        height: 512,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    });

    let left = 0;
    const composites = sharpImages.map((imgBuf) => {
      const position = { input: imgBuf, top: 0, left };
      left += 512;
      return position;
    });

    const finalBuffer = await composite.composite(composites).jpeg().toBuffer();
    const base64 = finalBuffer.toString("base64");

    res.json({ imageBase64: base64 });
  } catch (err) {
    console.error("Error en /upload:", err);
    res.status(500).json({ error: "Error procesando las imágenes." });
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
