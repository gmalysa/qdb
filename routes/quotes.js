/**
 * Routes for retrieving and viewing individiual quotes, including the voting stuff
 */

var fl = require('flux-link');
var db = require('db-filters');

var quotes = require('../quotes');
var admin = require('../admin');

/**
 * Performs a check to see if an id passes basic sanity tests. Creates an
 * exception if not.
 * @param env The environment where the id is stored
 * @param after The function to call in the event of a pass
 */
function check_id(env, after) {
	env.id = parseInt(env.req.params.id) || 0;
	if (env.id <= 0)
		env.$throw({}, 'Invalid quote id specified', mod_name);
	else
		after();
}
	

/**
 * Creates a chain that will be used to retrieve and display information about
 * a single quote
 * @return Handler chain that can be used to process this request
 */
function quote() {
	return new fl.Chain(
		check_id,
		function (env, after) {
			env.filters.quotes.select({id : env.id, flags : db.$neq(quotes.flags.pending)}).exec(after, env.$throw);
		},
		function (env, after, rows) {
			env.$template('quotes');
			env.$output({
				title : '#'+env.id,
				quotes : rows,
				admin : admin.isAdmin(env)
			});
			after();
		});
}

/**
 * Votes on a quote (up or down, depending on argument specified)
 * @param vote The vote direction that the generated chain should handle
 * @return Handler chain that can be used to process this request
 */
function quote_vote(vote) {
	return new fl.Chain(
		check_id,
		quotes.getUserVote,
		function (env, after, uVote) {
			if (uVote == 0)
				quotes.addUserVote(vote, env, after);
			else
				quotes.updateUserVote(vote, env, after, uVote);
		},
		quotes.getScore,
		quotes.updateScore,
		function (env, after) {
			env.$json({score : env.score, vote : vote});
			after();
		});
}

var quote_delete = new fl.Chain(
	check_id,
	function(env, after) {
		if (admin.isAdmin(env)) {
			after(env.id);
		}
		else {
			env.$throw();
		}
	},
	quotes.deleteQuote,
	function(env, after) {
		env.$json({success : true, id : env.id});
		after();
	});
quote_delete.set_exception_handler(function(env, err) {
	env.$json({success : false});
	env.$catch();
});

// Register routes with the server
module.exports.init_routes = function(server) {
	var pre = ['default', 'admin'];
	var post = ['default', 'pending'];
	server.add_route('/quote/:id', {fn : quote(), pre : pre, post : post});
	server.add_route('/quote/:id/up', {fn : quote_vote(1), post : post});
	server.add_route('/quote/:id/down', {fn : quote_vote(-1), post : post});
	server.add_route('/quote/:id/delete', {fn : quote_delete, pre : pre, post : post});
};
