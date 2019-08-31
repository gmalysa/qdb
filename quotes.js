/**
 * Functions for dealing with quotes, such as retrieving score, updating score,
 * and other stuff, placed into a convenient module. These functions are designed
 * to work with the standard call signature for controlflow-powered callback lists.
 * Bindable parameters go before the environment and must be bound. Any changes to
 * or values read from the environment are specified in the documentation block.
 *
 * Conventions on @return documentation specifies the information that is passed
 * to the next chain in the order they are passed as arguments.
 *
 * Inputs based on the environment are tagged with @env. Outputs in the environment
 * are tagged with @renv
 */

var logger = require('./logger');
var db = require('db-filters');

// List of possible quote flag values
module.exports.flags = {
	all : -1,
	none : 0,
	pending : 1,
	spam : 2,
	report : 4
};

/**
 * Inserts a new quote to the database
 * @param quote The quote to insert
 * @param flags Flags to apply to the quote by default
 * @env.req.ip IP address of the user submitting
 */
module.exports.addQuote = function(env, after, quote, flags) {
	var props = {
		score : 0,
		ip : env.req.ip,
		date : db.$now(),
		flags : flags,
		quote: quote};
	env.filters.quotes.insert(props).exec(after, env.$throw);
};

module.exports.deleteQuote = function(env, after, id) {
	env.filters.quotes.delete({id : id})
			.limit(1)
			.exec(after, env.$throw);
}

module.exports.editQuote = function(env, after, id, body) {
	env.filters.quotes.update({quote : body}, {id : id}).exec(after, env.$throw);
}

module.exports.pendingCount = function(env, after) {
	env.filters.quotes.select({flags : module.exports.flags.pending})
						.fields(db.$count('id'))
						.exec(after, env.$throw);
}

/**
 * Retrieve the current score for a given quote, based on the environment
 * @env.quoteId used to pick the quote whose score is retrieved
 * @renv.score is where the score is stored
 */
module.exports.getScore = function(env, after) {
	env.filters.quotes.select({id : env.id})
		.fields('score')
		.exec(function(rows) {
			env.score = parseInt(rows[0].score);
			after();
		}, env.$throw);
};

/**
 * Update the score for a given quote based on values in the environment
 * @env.quoteId used to identify the quote to update
 * @env.score is the previous score for this quote
 * @env.voteChange is the amount to adjust the score by
 * @renv.score the new score for this quote is written
 */
module.exports.updateScore = function(env, after) {
	env.score += env.voteChange;
	env.filters.quotes.update({score : env.score}, {id : env.id})
		.exec(after, env.$throw);
};

/**
 * Retrieve a user's vote for a particular quote
 * @env.id is used to identify the quote whose vote we want
 * @env.req.ip is used to identify the user who is voting
 * @return The vote, or zero if no vote was made
 */
module.exports.getUserVote = function(env, after) {
	env.filters.votes.select({ip : env.req.ip, quoteId : env.id})
		.fields('vote')
		.exec(function(result) {
			if (result.length == 0)
				after(0);
			else
				after(parseInt(result[0].vote));
		}, env.$throw);
};

/**
 * Adds a new vote for a user
 * @param vote The amount of the vote to add
 * @env.id The quoteId to add this vote for
 * @env.req.ip The ip address of the user to add this vote for
 * @renv.voteChange The amount by which to change this quote's score
 */
module.exports.addUserVote = function(vote, env, after) {
	var values = {
		ip : env.req.ip,
		quoteId : env.id,
		vote : vote,
		date : db.$now()
	};

	env.voteChange = vote;
	env.filters.votes.insert(values).exec(after, env.$throw);
};

/**
 * Update a user's vote if it is different from the specified matching
 * vote
 * @param match The vote to compare the user's vote to
 * @param vote The vote the user made
 * @env.quoteId The id of the quote whose vote is changing
 * @renv.voteChange The total amount of score adjustment that this user's vote change causes
 */
module.exports.updateUserVote = function(match, env, after, vote) {
	if (vote == match) {
		env.voteChange = 0;
		after();
	}
	else {
		env.voteChange = 2*match;
		env.filters.votes.update({vote : match, date : db.$now()},
			{ip : env.req.ip, quoteId : env.id})
			.exec(after, env.$throw);
	}
};
