/**
 * Everything needed to submit quotes
 */

// npm modules
var fl = require('flux-link');
var db = require('db-filters');
var captcha = require('math-captcha');
var mc = new captcha.CAPTCHA();

// Local/project modules
var logger = require('../logger');
var quotes = require('../quotes');
var bans = require('../bans');
var admin = require('../admin');

/**
 * Render a page to submit a new quote
 * @param env Request environment
 * @param after Callback for after handling submission
 */
function draw_submit(env, after) {
	env.$template('submit');
	env.$output({title : 'Submit'});
	after();
}

/**
 * Handles a submission from a user, requires POST
 */
function post_submit() {
	function setup_template(env, after) {
		env.$template('submit');
		env.$output({
			title : 'Submit',
			quotes : [{
				quote : env.req.body.quote,
				score : 0,
				id : 'new'
			}],
			preview : env.req.body.quote
		});
		after();
	};
	
	var real_submit = new fl.Chain(
		setup_template,
		bans.isUserBanned,
		function (env, after, banned) {
			if (banned)
				env.$throw({banned : true});
			else
				after();
		},
		function (env, after) {
			if (admin.isAdmin(env)) {
				after(env.req.body.quote, quotes.flags.none);
			}
			else if (env.req.body.captcha) {
				var ans = parseFloat(env.req.body.captcha_answer);
				if (mc.check(env.req.body.captcha, ans, 1)) {
					mc.cleanup(env.req.body.captcha);
					after(env.req.body.quote, quotes.flags.pending);
				}
				else {
					mc.cleanup(env.req.body.captcha);
					env.$throw({captcha : true});
				}
			}
			else {
				//env.filters.quotes.query('SELECT COUNT(*) AS count FROM quotes WHERE ip = '+nmysql.escape(env.req.ip)+' AND TIMESTAMPDIFF(MINUTE, date, NOW()) < 2',
				env.filters.quotes.select({ip : env.req.ip, date : db.$raw('TIMESTAMPDIFF(MINUTE, `date`, NOW()) < 1')})
					.fields([db.$count('id'), 'count'])
					.exec(function(rows) {
						if (parseInt(rows[0].count) > 10) {
							env.$throw({captcha : true});
						}
						else {
							after(env.req.body.quote, quotes.flags.pending);
						}
					}, env.$throw);
			}
		},
		quotes.addQuote,
		function (env, after, result) {
			env.$output({
				quotes : [{
					quote : env.req.body.quote,
					score : 0,
					id : result.insertId
				}],
				preview : ''
			});
			after();
		});
	
	// Real submission just uses the exception stack to skip the rest of processing
	real_submit.set_exception_handler(function(env, err) {
		// If the user was banned, catch and handle that
		if (err.banned) {
			env.$output({banned : true, ip : env.req.ip});
			env.$catch();
		}
		else if (err.captcha) {
			// Need to display a captcha to the user
			mc.generate(function(key) {
				env.$output({
					captcha : true,
					captcha_key : key
				});
				env.$catch();
			}, env.$throw);
		}
		else {
			// Not one of our intended exceptions, pass it up
			env.$throw(err);
		}
	});
	
	var preview_submit = new fl.Chain(setup_template);
	
	return function(env, after) {
		if (env.req.body.submit)
			real_submit.call(null, env, after);
		else
			preview_submit.call(null, env, after);
	};
}

/**
 * Handles captcha image rendering routes
 */
function get_captcha(env, after) {
	var key = env.req.params.key;
	var image = mc.getImage(key);

	if (image !== null) {
		env.res.sendfile(image, function(err) {
			if (err) {
				logger.error('Unable to send captcha file for key: '+key, 'captcha');
				logger.var_dump(err, {src : 'captcha'});
			}
		});
		env.$raw();
	}
	else {
		env.$error({}, 'Invalid captcha key supplied', 'captcha');
	}

	after();
}

// Required routing interface
module.exports.init_routes = function(server) {
	var pre_handlers = ['default', 'admin'];
	var post = ['default', 'pending'];
	server.add_route('/submit', {fn : draw_submit, post : post});
	server.add_route('/submit', {fn : post_submit(), pre : pre_handlers, post : post}, 'post');
	server.add_route('/captcha/:key', {fn : get_captcha, post : post});
}
