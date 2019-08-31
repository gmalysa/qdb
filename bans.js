/**
 * Functions for dealing with bans, such as checking if a user is banned, banning
 * and unbanning.
 *
 * This has the same conventions on @return, @env, and @renv as were described in
 * the quotes.js file
 */

var logger = require('./logger');
var admin = require('./admin');

var db = require('db-filters');

/**
 * Check if an ip address is banned
 * @env.ip The ip tested to see if it is banned
 * @return True if banned, false if not banned
 */
module.exports.isUserBanned = function(env, after) {
	env.filters.bans.select({ip : db.$inet_aton(env.req.ip)})
		.exec(function(result) {
			if (result.length > 0)
				after(true);
			else
				after(false);
		}, env.$throw);
};
