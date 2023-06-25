var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');

const imageDirectory = 'd:\\result'; // your result path  

router.get('/', (req, res) => {
  const id = parseInt(req.query.id);
  const n = 1;

  fs.readdir(imageDirectory, (err, files) => {
    if (err) {
      console.error('Erreur lors de la lecture du dossier des images:', err);
      res.status(500).send('Erreur du serveur');
      return;
    }

    const startIndex = id || 0;

    if (startIndex < files.length) {
      const endIndex = startIndex + n;
      const selectedFiles = files.slice(startIndex, endIndex);
      const imagePaths = selectedFiles.map((filename, index) => {
        const imagePath = path.join(imageDirectory, filename);
        const link = `http://localhost:3000/image/${id}`;
        
        return {
          src: link,
          link: link,
          alt: imagePath, // Remplacez par la description de l'image souhaitée
          title: 'Titre de l\'image' // Remplacez par le titre de l'image souhaité
        };
      });
      

      
      console.log(imagePaths)
      res.render("index", {
        id: id,
        n: n,
        images: imagePaths
      })
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
