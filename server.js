const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");

const app = express();
app.use(cors());

const upload = multer().array("images"); // <-- DEBE COINCIDIR CON "images"

app.post("/upload", upload, async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No se recibieron imágenes." });
    }

    const resizedBuffers = await Promise.all(
      files.map(file =>
        sharp(file.buffer)
          .resize({ width: 600 })
          .jpeg()
          .toBuffer()
      )
    );

    // Concatenar horizontalmente como ejemplo
    const { width, height } = await sharp(resizedBuffers[0]).metadata();
    const stitchedImage = await sharp({
      create: {
        width: width * resizedBuffers.length,
        height,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
      .composite(resizedBuffers.map((input, i) => ({
        input,
        left: i * width,
        top: 0
      })))
      .jpeg()
      .toBuffer();

    const base64 = stitchedImage.toString("base64");
    res.json({ imageBase64: `data:image/jpeg;base64,${base64}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
