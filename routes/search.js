/**
 * Renders the search page and search results
 */

var fl = require('flux-link');
var db = require('db-filters');

var quotes = require('../quotes.js');
var admin = require('../admin.js');

/**
 * Render a page to allow users to search for quotes
 */
function draw_search(env, after) {
	env.$template('search');
	env.$output({title : 'Search'});
	after();
}

/**
 * Respond to a search and print out the results
 */
function post_search() {
	return new fl.Chain(
		function (env, after) {
			var direction = parseInt(env.req.body.order) == 1 ? db.$desc : db.$asc;
			var order = (env.req.body.sort == 'id' ? 'id' : 'score');
			env.search = (env.req.body.search ? '%'+env.req.body.search+'%' : '%');
			env.order = direction(order);
			env.limit = parseInt(env.req.body.count) || 10;
			after();
		},
		function (env, after) {
			env.filters.quotes.select({quote : db.$like(env.search), flags : db.$neq(quotes.flags.pending)})
				.order(env.order)
				.limit(env.limit)
				.exec(after, env.$throw);
		},
		function (env, after, rows) {
			env.$output({
				title : 'Search Results',
				quotes : rows,
				admin : admin.isAdmin(env)
			});
			env.$template('quotes');
			after();
		});
}

// Export and initialize the module
module.exports.init_routes = function(server) {
	var pre = ['default', 'admin'];
	var post = ['default', 'pending'];
	server.add_route('/search', {fn : draw_search, pre : pre, post : post});
	server.add_route('/search', {fn : post_search(), post : post}, 'post');
};
