app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Cambia * por tu dominio si quieres más seguridad
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});


const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Ruta para subir varias imágenes (form-data con campo "images")
app.post('/upload', upload.array('images', 20), async (req, res) => {
  try {
    const images = req.files;
    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    // Leer buffers de todas las imágenes
    const buffers = await Promise.all(images.map(file => fs.promises.readFile(file.path)));

    // Obtener metadatos para saber alturas y anchos
    const metadataArray = await Promise.all(buffers.map(buf => sharp(buf).metadata()));

    // Escalar todas las imágenes a la altura mínima para que queden iguales verticalmente
    const minHeight = Math.min(...metadataArray.map(m => m.height));

    const resizedBuffers = await Promise.all(buffers.map((buf, i) =>
      sharp(buf)
        .resize({ height: minHeight })
        .toBuffer()
    ));

    // Concatenar imágenes horizontalmente
    const stitchedImage = await sharp({
      create: {
        width: resizedBuffers.reduce((acc, buf, i) => acc + metadataArray[i].width * (minHeight / metadataArray[i].height), 0),
        height: minHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    }).composite(
      resizedBuffers.map((buf, i) => {
        const offsetX = resizedBuffers
          .slice(0, i)
          .reduce((acc, b, idx) => acc + Math.round(metadataArray[idx].width * (minHeight / metadataArray[idx].height)), 0);
        return { input: buf, left: offsetX, top: 0 };
      })
    ).jpeg().toBuffer();

    // Borrar archivos temporales
    for (const file of images) {
      fs.unlink(file.path, () => {});
    }

    // Responder con la imagen panorámica en base64
    res.json({ imageBase64: stitchedImage.toString('base64') });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error processing images' });
  }
});

// Servir frontend o página simple
app.get('/', (req, res) => {
  res.send('Stitching server running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
