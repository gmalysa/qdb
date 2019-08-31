/**
 * Module to provide login routes for administration interface
 */

var fl = require('flux-link');
var db = require('db-filters');

var quotes = require('../../quotes');
var admin = require('../../admin');

function show_login(env, after) {
	if (admin.isAdmin(env)) {
		env.$redirect('/admin/pending');
	}
	else {
		env.$template('admin_login');
		env.$output({title : 'Login'});
	}
	after();
};

function do_login() {
	var ret = new fl.Chain(
		function load_params(env, after) {
			after(env.req.body.username, env.req.body.password);
		},
		admin.login,
		function check_login(env, after, result) {
			if (result.admin === true) {
				env.$redirect('/admin/pending');
			}
			else {
				env.$template('admin_login');
				env.$output({title : 'Login', failed : true});
			}
			after();
		}
	);

	return ret;
};

// Set up admin routes
module.exports.init_routes = function(server) {
	var pre_handlers = ['default', 'admin'];
	server.add_route('/admin/login', {fn : show_login, pre : pre_handlers}, 'get');
	server.add_route('/admin/login', {fn : do_login(), pre : pre_handlers}, 'post');
}
