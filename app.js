var express = require('express')
  , tpl = require('express-micro-tpl')
  , session = require('express-session')
  , bodyParser = require('body-parser')
  , cookieParser = require('cookie-parser')
  , serveStatic = require('serve-static')
  , middlewarePipe = require('middleware-pipe')
  , tplPlugin = require('./gulp/tpl')
  , app = express()
  , server = require('http').createServer(app)
  , router = require('./controller/router')
  , orm = require('orm')
  , fs = require('fs');


var  log4js = require('log4js'),
    logger = log4js.getLogger();



var argv = process.argv.slice(2);
if(argv.indexOf('--debug') >= 0){
    logger.setLevel('DEBUG');
    GLOBAL.DEBUG = true;
    logger.info('running in debug');
    GLOBAL.pjconfig =  require('./project.debug.json');
}else {
    logger.setLevel('INFO');
    GLOBAL.pjconfig = require('./project.json');
}

app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.engine('html', tpl.__express);
app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 30 * 60 * 1000 } }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/css', middlewarePipe('./static/css',
    /\.css$/, function (url) {
      return url.replace(/\.css$/, '.scss');
    })
);
app.use('/js', middlewarePipe('./static/js',
    /\.tpl\.js$/, function (url) {
      return url.replace(/\.js/, '.html');
    }).pipe(function () {
      return tplPlugin();
    })
);
app.use(serveStatic('static'));


var msqlUrl = GLOBAL.pjconfig.mysql.url;


app.use(orm.express(msqlUrl, {
  define: function (db, models, next) {

        db.use(require("orm-transaction"));
        models.userDao = require('./dao/UserDao')(db);
        models.applyDao = require('./dao/ApplyDao')(db);
        models.approveDao = require('./dao/ApproveDao')(db);
        models.userApplyDao = require('./dao/UserApplyDao')(db);
        models.statisticsDao = require('./dao/StatisticsDao')(db);
        models.db = db;

        global.models = models;
        logger.info('mysql connected');
        next();
  }}));

app.use(function (err, req, res, next) {
    res.send(err.stack);
});


router(app);


server.listen(80);

logger.info('start badjs-web , listen 80 ...');



setTimeout(function (){
    var service = require("./service/StatisticsService");
    logger.info('start startMonitor ...');
    new service().startMonitor();


    var LogService = require("./service/LogService");
    new LogService().pushProject(function (e){
        logger.info('push project on system start');
    });
},3000)
