/**
 * Main server entry point, this configures express and attaches the relevant pathes,
 * most of which are defined in other files.
 */
// Configuration options
var mod_name = 'qdb server';
var mod_version = '0.4.1';

// Server config
var port = 8124;
var env = 'development';

// node.js and other libraries
var express = require('express');
var db = require('db-filters');
var fl = require('flux-link');

// Private libraries
var logger = require('./logger');
var mysql = require('./mysql');
var common = require('./common');
var admin = require('./admin');
var quotes = require('./quotes');

/**
 * Gets a connection from the mysql pool and clones instances
 * of database filter objects for our use. This is generally
 * the first step in handling any request.
 */
function init_db(env, after) {
	env.filters = db.clone_filters(db.filters);

	mysql.getValidConnection(env, function() {
		db.set_conn_all(env.conn, env.filters);
		after();
	});
}

/**
 * Cleans up the database connection
 */
function cleanup_db(env, after) {
	if (env.conn)
		env.conn.end();
	after();
}

var base_url = 'http://qdb.swcombine.com';

// Set up custom dust functions
var dh = require('./dust_functions');
var dust_filters = {
	quotify : dh.dust_quotify,
	d2u : dh.dust_dot2underscore
};
var dust_helpers = {
	paginate		: dh.dust_paginate.bind(null, base_url),
	page_link		: dh.dust_paginate_body.bind(null, 'isLink'),
	page_ellipses	: dh.dust_paginate_body.bind(null, 'isEllipsis'),
	page_active		: dh.dust_paginate_body.bind(null, 'isActive'),
	voted_img		: dh.dust_vote_check.bind(null, base_url),
};

// Initialize mysql
var mysql = new mysql({database : 'qdb'});
db.init(process.cwd() + '/filters', function(file) {
	logger.info('Adding database definition ' + file.blue.bold + '...', 'db-filters');
}, db.l_info);

db.set_log(function(msg) {
	logger.info(msg, 'db-filters');
});

// Initialize the common server
var server = express();
var ci = new common.init(server, {
	port		: port,
	set			: {env : env},
	shutdown	: [{fn : mysql.deinit, ctx : mysql}],
	base_url	: base_url
});

// Add helpers and hooks
ci.add_dust_helpers(dust_helpers);
ci.add_dust_filters(dust_filters);

// Default helpers, used by most routes
ci.add_pre_hook(fl.mkfn(init_db, 0));
ci.add_post_hook(fl.mkfn(cleanup_db, 0));

// Admin-only page helpers
ci.add_pre_hook(admin.initAdmin, 'admin');

var pending_hook = new fl.Chain(
	quotes.pendingCount,
	function (env, after, result) {
		env.$output({pending_count : result[0]['COUNT(`id`)'] | 0});
		after();
	});
ci.add_post_hook(pending_hook, 'pending');

// Finally!
logger.module_init(mod_name, mod_version, 'qdb server online');
