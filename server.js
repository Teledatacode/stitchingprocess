const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Permite cualquier origen (para pruebas)
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.post('/upload', upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    // Lee los buffers de los archivos recibidos
    const buffers = await Promise.all(req.files.map(file => fs.promises.readFile(file.path)));

    // Obtén la altura mínima para escalar todas las imágenes igual
    const metadataArray = await Promise.all(buffers.map(buf => sharp(buf).metadata()));
    const minHeight = Math.min(...metadataArray.map(m => m.height));

    // Redimensiona todas las imágenes a esa altura mínima
    const resizedBuffers = await Promise.all(buffers.map((buf, i) =>
      sharp(buf).resize({ height: minHeight }).toBuffer()
    ));

    // Calcula ancho total sumando anchos escalados
    const totalWidth = resizedBuffers.reduce((acc, buf, i) => {
      return acc + Math.round(metadataArray[i].width * (minHeight / metadataArray[i].height));
    }, 0);

    // Une las imágenes horizontalmente
    let offsetX = 0;
    const compositeArray = resizedBuffers.map((buf, i) => {
      const input = { input: buf, left: offsetX, top: 0 };
      offsetX += Math.round(metadataArray[i].width * (minHeight / metadataArray[i].height));
      return input;
    });

    const stitchedImage = await sharp({
      create: {
        width: totalWidth,
        height: minHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .composite(compositeArray)
    .jpeg()
    .toBuffer();

    // Borra archivos temporales
    req.files.forEach(file => {
      fs.unlink(file.path, () => {});
    });

    res.json({ imageBase64: stitchedImage.toString('base64') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error processing images' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
