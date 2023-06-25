var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');

const imageDirectory = 'd:\\result';

router.get('/', (req, res) => {
  const id = parseInt(req.query.id);
  const n = 2;

  fs.readdir(imageDirectory, (err, files) => {
    if (err) {
      console.error('Erreur lors de la lecture du dossier des images:', err);
      res.status(500).send('Erreur du serveur');
      return;
    }

    const startIndex = id >= 0 ? id : 0;

    if (startIndex < files.length) {
      const endIndex = startIndex + n;
      const selectedFiles = files.slice(startIndex, endIndex);
      const imagePaths = selectedFiles.map(filename => path.join(imageDirectory, filename));

      const response = {
        id: id,
        n: n,
        images: imagePaths
      };

      res.send(response);
    } else {
      res.status(404).send('Aucune image trouvée');
    }
  });
});
router.get('/image/:position', (req, res) => {
  const position = parseInt(req.params.position);

  fs.readdir(imageDirectory, (err, files) => {
    if (err) {
      console.error('Erreur lors de la lecture du dossier des images:', err);
      res.status(500).send('Erreur du serveur');
      return;
    }

    if (position >= 0 && position < files.length) {
      const imageName = files[position];
      const imagePath = path.join(imageDirectory, imageName);
      res.sendFile(imagePath);
    } else {
      res.status(404).send('Image non trouvée');
    }
  });
});



module.exports = router;
