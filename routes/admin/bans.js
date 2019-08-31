/**
 * Module to review and adjust user IP bans by administrators
 */

var fl = require('flux-link');
var db = require('db-filters');

var admin = require('../../admin');

/**
 * List all bans, mostly just uses the ban template to do the hard work
 */
function list_bans() {
	var ret = new fl.Branch(
		function check(env, after) {
			after(admin.isAdmin(env));
		},
		new fl.Chain(
			function list(env, after) {
				env.filters.bans.select()
						.fields([db.$inet_ntoa('ip'), 'ip'], 'reason', 'date')
						.exec(after, env.$throw);
			},
			function render(env, after, bans) {
				env.$template('admin_bans');
				env.$output({
					title : 'Ban List',
					bans : bans,
					admin : true
				});
				after();
			}),
		function redirect(env, after) {
			env.$redirect('/');
			after();
		});
	ret.name = 'list_bans';
	return ret;
}

/**
 * Adds a ban, called via ajax
 */
function add_ban(env, after) {
	if (admin.isAdmin(env)) {
		var adminId = env.req.session.admin.id;
		var ip = env.req.body.ip;
		var reason = env.req.body.reason;

		if (ip.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)) {
			env.filters.bans.insert({adminId : adminId, ip : db.$inet_aton(ip), reason : reason, date : db.$now()})
							.exec(function() {
								env.$redirect('/admin/ban');
								after();
							}, env.$throw);
		}
		else {
			env.$json({err : true, msg : 'IP address specified in invalid format'});
			after();
		}
	}
	else {
		env.$json({err : true});
		after();
	}
}

/**
 * Removes a ban, called via ajax
 */
function remove_ban(env, after) {
	if (admin.isAdmin(env)) {
		var ip = env.req.params.ip;

		if (!ip.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)) {
			env.$json({err : true, msg : 'Invalid IP specified'});
			after();
		}
		else {
			env.filters.bans.delete({ip : db.$inet_aton(ip)})
								.exec(function() {
									env.$json({err : false});
									after();
								}, env.$throw);
		}
	}
	else {
		env.$json({err : true});
		after();
	}
}

// Set up routes
module.exports.init_routes = function(server) {
	var pre_handlers = ['default', 'admin'];
	server.add_route('/admin/ban', {fn : list_bans(), pre : pre_handlers});
	server.add_route('/admin/ban/add', {fn : add_ban, pre : pre_handlers}, 'post');
	server.add_route('/admin/ban/remove/:ip', {fn : remove_ban, pre : pre_handlers});
}
