// server.js
// where your node app starts

// include modules
const express = require('express');

const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const FormData = require("form-data");

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

// shhh... it's a secret
let ecs162ApiKey = "jb48bavkw0";

db.run("CREATE TABLE IF NOT EXISTS postcards(" +
  "id text PRIMARY KEY," +
  "image text NOT NULL," +
  "color text NOT NULL," +
  "font text NOT NULL," +
  "message text NOT NULL" +
  ")");

function makeId(length) {
  var result = '';
  var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

let storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, __dirname + '/images')
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname)
  }
})
// let upload = multer({dest: __dirname+"/assets"});
let upload = multer({
  storage: storage
});


// begin constructing the server pipeline
const app = express();



// Serve static files out of public directory
app.use(express.static('public'));

// Also serve static files out of /images
app.use("/images", express.static('images'));

// Handle GET request to base URL with no other route specified
// by sending creator.html, the main page of the app
app.get("/", function(request, response) {
  response.sendFile(__dirname + '/public/creator.html');
});

// Next, the the two POST AJAX queries

// Handle a post request to upload an image.
app.post('/upload', upload.single('newImage'), function(request, response) {
  console.log("Recieved", request.file.originalname, request.file.size, "bytes")
  if (request.file) {
    // we'll send the image from the server in a FormData object
    let form = new FormData();
    // we can stick other stuff in there too, like the apiKey
    form.append("apiKey", ecs162ApiKey);
    // stick the image into the formdata object
    form.append("storeImage", fs.createReadStream(__dirname+ "/images/" + request.file.originalname));
    // and send it off to this URL
    form.submit("http://ecs162.org:3000/fileUploadToAPI", function(err, APIres) {
      // did we get a response from the API server at all?
      if (APIres) {
        // delete local image
        fs.unlinkSync(__dirname+ "/images/" + request.file.originalname)

        // OK we did
        console.log("API response status", APIres.statusCode);
        // the body arrives in chunks - how gruesome!
        // this is the kind stream handling that the body-parser
        // module handles for us in Express.
        let body = "";
        APIres.on("data", chunk => {
          body += chunk;
        });
        APIres.on("end", () => {
          // now we have the whole body
          if (APIres.statusCode != 200) {
            response.status(400); // bad request
            response.send("Media server says: " + body);
          } else {
            response.status(200);
            response.send(body);
          }
        });
      } else { // didn't get APIres at all
        response.status(500); // internal server error
        response.send("Media server seems to be down.");
      }
    });
  } else throw 'error';
});

// Handle a post request containing JSON
app.use(bodyParser.json());
// gets JSON data into req.body
app.post('/saveDisplay', function(req, res) {
  console.log(req.body);
  // store postcard JSON into sql database
  let id = makeId(22);
  // there is a very low chance the id will have been taken
  // auto increment is better to prevent collisions
  db.run("INSERT INTO postcards (id, image, color, font, message) " +
    "VALUES('" + id + "','" +
    req.body.image + "','" +
    req.body.color + "','" +
    req.body.font + "','" +
    req.body.message + "');", (err) => {
      if (err) {
        res.status(404).send('postcard not saved');
      } else {
        // send back the shareable id
        responseData = {
          "id": id
        }
        res.send(JSON.stringify(responseData))
      }
    });
});

// get the postcard data
app.post('/getDisplay', function(req, res) {
  console.log(req.body);
  let sqlStatement = "SELECT * FROM postcards " +
    "WHERE id=?";
  console.log(sqlStatement);
  db.get(sqlStatement, [req.body.id], (err, rows) => {
    if (err) {
      res.status(404).send('postcard not found');
    } else {
      console.log(rows);
      if (rows) {
        responseData = {
          "image": rows.image,
          "color": rows.color,
          "font": rows.font,
          "message": rows.message,
        };
      }
      res.send(JSON.stringify(responseData));
    }
  });
});

// The GET AJAX query is handled by the static server, since the
// file postcardData.json is stored in /public

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
