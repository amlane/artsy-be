const router = require("express").Router();
const jwt_decode = require("jwt-decode");

const Photos = require("./photos-model.js");
const Comments = require("../comments/comments-model.js");
const restricted = require("../auth/restricted-middleware");

// ---------------------- /api/photos ---------------------- //

router.get("/", async (req, res) => {
  try {
    const photos = await Photos.getAllPhotos();

    Promise.all(
      photos.map(async photo => {
        const likes = await Photos.getLikesCount(photo.id);
        const comments = await Comments.getCommentsByPhotoId(photo.id);
        photo.likes = likes.count;
        photo.comments = comments.length;
        return photo;
      })
    )
      .then(photos => {
        res.status(200).json({ photos });
      })
      .catch(err => {
        res.status(500).json(err);
      });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("/:id", verifyPhotoId, async (req, res) => {
  try {
    const id = req.params.id;

    const photo = await Photos.getPhotoById(id);
    photo.comments = await Comments.getCommentsByPhotoId(id);
    res.status(200).json({ photo });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("/search/:title", (req, res) => {
  const title = req.params.title;
  Photos.search(title)
    .then(results => {
      res.status(200).json(results);
    })
    .catch(err => {
      res.status(500).json({ err });
    });
});

router.post("/", restricted, verifyPostContent, (req, res) => {
  let photo = req.body;
  const token = req.headers.authorization;
  const decoded = jwt_decode(token);
  photo.user_id = decoded.subject;

  Photos.addNewPhoto(photo)
    .then(newPhoto => {
      res.status(201).json({ newPhoto });
    })
    .catch(err => {
      res.status(500).json(err);
    });
});

router.put(
  "/:id",
  restricted,
  verifyPhotoId,
  verifyPostContent,
  verifyUser,
  (req, res) => {
    const id = req.params.id;
    const changes = req.body;

    Photos.update(id, changes)
      .then(updatedPhoto => {
        res.status(201).json(updatedPhoto);
      })
      .catch(err => {
        res.status(500).json(err);
      });
  }
);

router.delete("/:id", restricted, verifyPhotoId, verifyUser, (req, res) => {
  const id = req.params.id;

  Photos.remove(id)
    .then(deleted => {
      res.status(200).json({ message: "Photo deleted." });
    })
    .catch(err => {
      res.status(500).json(err);
    });
});

router.post("/:id/like", restricted, (req, res) => {
  const photo_id = req.params.id;
  const token = req.headers.authorization;
  const decoded = jwt_decode(token);
  const user_id = decoded.subject;

  Photos.addLike(user_id, photo_id)
    .then(results => {
      Promise.all(
        results.map(async photo => {
          const likes = await Photos.getLikesCount(photo.id);
          const comments = await Comments.getCommentsByPhotoId(photo.id);
          photo.likes = likes.count;
          photo.comments = comments.length;
          return photo;
        })
      ).then(photos => {
        res.status(200).json({ photos });
      });
    })
    .catch(err => {
      res.status(500).json(err);
    });
});

router.delete("/:id/unlike", restricted, (req, res) => {
  const photo_id = req.params.id;
  const token = req.headers.authorization;
  const decoded = jwt_decode(token);
  const user_id = decoded.subject;

  Photos.removeLike(user_id, photo_id)
    .then(results => {
      Promise.all(
        results.map(async photo => {
          const likes = await Photos.getLikesCount(photo.id);
          const comments = await Comments.getCommentsByPhotoId(photo.id);
          photo.likes = likes.count;
          photo.comments = comments.length;
          return photo;
        })
      ).then(photos => {
        res.status(200).json({ photos });
      });
    })
    .catch(err => {
      res.status(500).json(err);
    });
});

// ---------------------- Custom Middleware ---------------------- //

function verifyPhotoId(req, res, next) {
  const id = req.params.id;

  Photos.findById(id)
    .then(item => {
      if (item) {
        req.item = item;
        next();
      } else {
        res.status(404).json({ message: "Photo Not Found." });
      }
    })
    .catch(err => {
      res.status(500).json({ err });
    });
}

function verifyPostContent(req, res, next) {
  if (
    req.body.photo_url === "" ||
    req.body.photo_url === null ||
    req.body.title === "" ||
    req.body.title === null
  ) {
    res.status(400).json({ message: "Photo url and title are required." });
  } else {
    next();
  }
}

async function verifyUser(req, res, next) {
  const id = req.params.id;
  const token = req.headers.authorization;
  const decoded = jwt_decode(token);
  const photo = await Photos.getPhotoById(id);

  if (+photo.user_id === decoded.subject) {
    next();
  } else {
    res.status(401).json({
      message: "You are not authorized to perform this request on another user."
    });
  }
}

module.exports = router;
