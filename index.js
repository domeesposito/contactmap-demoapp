var Sequelize = require('sequelize');
var async = require('async');
var geocode = require('./geocode');

// ************** DATABASE MODELS ***********************

var dburl = process.env.DATABASE_URL || 'postgres://localhost/herokuconnect';
var db = new Sequelize(dburl, {
				dialectOptions: {
					ssl: dburl.indexOf('localhost') == -1
				},
				logging: false
			 });

// questa è connesione alla tabella contact sync da salesforce >> eventualmente se dovete aggiungere qsa è qui che lo fai
var Contact = db.define('Contact', {
	id: Sequelize.INTEGER,
	sfid: Sequelize.STRING,
	email: Sequelize.STRING,
	name: Sequelize.STRING,
	mailingcity: Sequelize.STRING,
	mailingstate: Sequelize.STRING,
	mailingstreet: Sequelize.STRING
}, {
	timestamps: false,
	freezeTableName: true,
	schema: 'salesforce',
	tableName: 'contact'
	}
);

//come sopra, ma è l'altra tabella
Geocode = db.define('geocode', {
    id: Sequelize.INTEGER,
    address: Sequelize.STRING,
    lat: Sequelize.FLOAT,
    lon: Sequelize.FLOAT
});

// Create geocode cache table if not exists
db.sync();

// ************** GEOCODING LOGIC ***********************

var contact_locations = [];


//questa è la funzione che scrive le coordinate sulla tabma prima di scriverle chiama geocode()
function geocode_contact(contact, callback) {
	if (contact.values.mailingstreet || 
		contact.values.mailingcity || 
		contact.values.mailingstate) {

		var addr = contact.values.mailingstreet + "," + 
					contact.values.mailingcity + "," + 
					contact.values.mailingstate;

		geocode(addr, function(geocode) {
			if (geocode) {
				callback(null, {name: escape(contact.values.name), lat: geocode.lat, lon:geocode.lon});
			} else {
				callback();
			}
		});
	} else {
		callback();
	}
}
// fa una query sula tabelle  e prende tutti i contatti
function load_contacts(callback) {
	Contact.findAll({limit:200}).then(function(rows) {
		async.map(rows, geocode_contact, callback);
	});
}



// EXPRESS
/*---------------------------------*/
var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.set('views', './views');
app.set('view engine', 'ejs');

/*app.get('/', function(req, res) {
	load_contacts(function(error, contact_locations) {
		console.log("Locations: ", contact_locations);
		res.render('index', {contact_locations: contact_locations.filter(function(val) { return val })});
	});
});*/

app.get('/map', function(req, res) {
	load_contacts(function(error, contact_locations) {
		console.log("Locations: ", contact_locations);
		res.render('index', {contact_locations: contact_locations.filter(function(val) { return val })});
	});
});

app.get('/',function(req, res){
	
		res.render('preload');
	
} 

app.get('/create', function(req, res){
  var create_url = 'https://connect.heroku.com/dashboard-next/create-connection';
  // Redirect to Heroku Connect dashboard to finish setup
  var hostRe = new RegExp(/^([^.]+)\.herokuapp\.com$/);

  var match = req.headers.host.match(hostRe);

  if (match) {
    res.redirect(create_url+'?create='+match[1]);
  } else {
    res.status(400).send("You need to be running on Heroku!");
  }
});

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});

// tutto questo blocco è il routing di nodejs
// dove vedi "/" vuol dire che quando entri nella root ( da url ) dell'applicazione invoca la nz load_contacts
//una volta recuperate le coordinate e messe nell'array
//l'app dice a node js di fare il render dlela pagina index.html
// STOP > banale