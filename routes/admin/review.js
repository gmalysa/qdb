/**
 * Module to review pending quote submissions
 */

var fl = require('flux-link');
var db = require('db-filters');

var quotes = require('../../quotes');
var admin = require('../../admin');

/**
 * Show a list of all pending quotes along with the moderation links
 */
function get_pending_quotes() {
	var ret = new fl.Branch(
		function check(env, after) {
			after(admin.isAdmin(env));
		},
		new fl.Chain(
			function getPageId(env, after) {
				env.page = parseInt(env.req.params.page) || 1;
				env.filters.quotes.select({flags : quotes.flags.pending})
					.fields([db.$count('id'), 'count'])
					.exec(after, env.$throw);
			},
			function getPendingQuotes(env, after, rows) {
				env.count = parseInt(rows[0].count);
				env.filters.quotes.select({flags : quotes.flags.pending})
					.limit([(env.page-1)*50, 50])
					.exec(after, env.$throw);
			},
			function doOutput(env, after, rows) {
				env.$template('quotes');
				env.$output({
					title : 'Pending Quotes',
					quotes : rows,
					count : env.count,
					page : env.page,
					url : '/admin/pending/',
					pending : true,
					admin : true
				});
				after();
			}),
		function redirect(env, after) {
			env.$redirect('/');
			after();
		});
	ret.name = 'get_pending_quotes';
	return ret;
}

/**
 * Approve a pending quote, called via ajax
 */
function approve_quote(env, after) {
	if (!admin.isAdmin(env)) {
		env.$json({err : true});
		after();
	}
	else {
		var id = parseInt(env.req.params.id) || 0;
		if (id === 0) {
			env.$json({err : true});
			after();
		}
		else {
			env.$json({});
			env.filters.quotes.update({flags : quotes.flags.none}, {id : id})
								.exec(after, env.$throw);
		}
	}
}

/**
 * Reject a pending quote, called via ajax
 */
function reject_quote(env, after) {
	if (!admin.isAdmin(env)) {
		env.$json({err : true});
		after();
	}
	else {
		var id = parseInt(env.req.params.id) || 0;
		if (id === 0) {
			env.$json({err : true});
			after();
		}
		else {
			env.$json({});
			env.filters.quotes.delete({id : id})
								.exec(after, env.$throw);
		}
	}
}

// Set up admin routes
module.exports.init_routes = function(server) {
	var pre_handlers = ['default', 'admin'];
	server.add_route('/admin/pending/:page?', {fn : get_pending_quotes(), pre : pre_handlers});
	server.add_route('/admin/approve/:id', {fn : approve_quote, pre : pre_handlers});
	server.add_route('/admin/reject/:id', {fn : reject_quote, pre : pre_handlers});
}
