/**
 * Functions for interacting with administrative objects, including login, creation/deletion,
 * and identity verification.
 *
 * This has the same conventions on @return, @env, and @renv as were described in quotes.js
 */

var _ = require('underscore');
var db = require('db-filters');

/**
 * Parse session data to produce admin object, which is stored in the session itself
 * @renv Updates request session information with admin status
 */
module.exports.initAdmin = function(env, after) {
	if (env.req.session.admin === undefined) {
		env.req.session.admin = {admin : false};
	}
	after();
};

/**
 * Check if a user is an administrator by looking at the admin object given
 * @param env The request environment object where we can read out admin status
 * @return true if admin, false otherwise
 */
module.exports.isAdmin = function(env) {
	return env.req.session.admin.admin;
};

/**
 * Handle a login attempt, modifying the session to store results and
 * then passing the admin object to the next function
 * @param username The username to login with
 * @param password The password to login with
 * @return admin The resulting admin object
 */
module.exports.login = function(env, after, username, password) {
	env.filters.admin.select({salt_pass : password, name : username})
				.limit(1)
				.exec(function(results) {
					if (results.length == 1) {
						env.req.session.admin = _.extend(results[0], {admin : true});
					}
					else {
						env.req.session.admin = {admin : false};
					}
					after(env.req.session.admin);
				}, env.$throw);
};
