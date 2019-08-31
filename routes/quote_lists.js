/**
 * Routes for quote lists, that is, pages that show more than one quote on them at a time
 */

var fl = require('flux-link');
var db = require('db-filters');
var mysql = require('mysql');

var logger = require('../logger');
var quotes = require('../quotes');
var admin = require('../admin');

/**
 * Retrieves a list of quotes and renders the related web page. Because there are
 * many similar types of quotes pages, up to order clause and page title, this
 * produces an appropriate handler chain
 * @param order The parameters for ordering these quotes
 * @param title The page title
 * @return Handler chain that can be used to process this request
 */
function get_quotes(order, title) {
	return new fl.Chain(
		function (env, after) {
			env.filters.quotes.select({flags : quotes.flags.none})
				.order(order)
				.limit(50)
				.exec(after, env.$throw);
		},
		function (env, after, rows) {
			var ids = rows.map(function(v) { return v.id; });

			env.quotes = rows;
			var select =env.filters.votes.select({quoteId : ids, ip : env.req.ip})
				.fields('quoteId', 'vote')
				.exec(after, env.$throw);
		},
		function (env, after, rows) {
			rows.forEach(function(v) {
				env.quotes.forEach(function(q) {
					if (q.id == v.quoteId)
						q.vote = v.vote;
				});
			});

			env.$template('quotes');
			env.$output({title : title, quotes : env.quotes, admin : admin.isAdmin(env)});
			after();
		});
}

/**
 * Retrieves a list of quotes sorted by a particular order, but also paginates.
 * @param order Information for select.order()
 * @param title Page title to display
 * @param url Page url to use for pagination link creation
 * @return Handler chain that can be used to process a paged quotes request
 */
function get_quotes_paged(order, title, url) {
	return new fl.Chain(
		function (env, after) {
			env.page = parseInt(env.req.params.page) || 1;
			after();
		},
		function (env, after) {
			env.filters.quotes.select({flags : quotes.flags.none})
				.fields([db.$count('id'), 'count'])
				.exec(after, env.$throw);
		},
		function (env, after, rows) {
			env.count = parseInt(rows[0].count);
			env.filters.quotes.select({flags : quotes.flags.none})
				.order(order)
				.limit([(env.page-1)*50, 50])
				.exec(after, env.$throw);
		},
		function (env, after, rows) {
			var ids = rows.map(function(v) { return v.id; });

			env.quotes = rows;
			var select =env.filters.votes.select({quoteId : ids, ip : env.req.ip})
				.fields('quoteId', 'vote')
				.exec(after, env.$throw);
		},
		function (env, after, rows) {
			rows.forEach(function(v) {
				env.quotes.forEach(function(q) {
					if (q.id == v.quoteId)
						q.vote = v.vote;
				});
			});

			env.$template('quotes');
			env.$output({
				title : title,
				quotes : env.quotes,
				count : env.count,
				page : env.page,
				url : url,
				admin : admin.isAdmin(env)
			});
			after();
		});
}

// Router interface
module.exports.init_routes = function(server) {
	var pre = ['default', 'admin'];
	var post = ['default', 'pending'];
	server.add_route('/latest', {fn : get_quotes([db.$desc('date'), db.$desc('id')], 'Latest'), pre : pre, post : post});
	server.add_route('/random', {fn : get_quotes(db.$rand(), 'Random'), pre : pre, post : post});
	server.add_route('/best/:page?', {fn : get_quotes_paged(db.$desc('score'), 'Best', '/best/'), pre : pre, post : post});
	server.add_route('/worst/:page?', {fn : get_quotes_paged(db.$asc('score'), 'Worst', '/worst/'), pre : pre, post : post});
	server.add_route('/all/:page?', {fn : get_quotes_paged(db.$asc('id'), 'All', '/all/'), pre : pre, post : post});
};
